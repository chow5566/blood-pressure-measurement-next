# 02 · Win7 / 32 位兼容性约束（最高优先级）

> 本文档是重构的**硬约束基线**。任何技术选型都不得违反本文件的结论。
> 结论来源：Electron 官方公告 + 各依赖官方支持矩阵（已核实部分见文末「核实记录」）。

## 1. 结论速览

| 项目 | 结论 |
| --- | --- |
| Electron 版本 | **锁定 `22.3.27`**（最后一个支持 Win7/8/8.1 的大版本） |
| Chromium / Node / V8 | Chromium `108` / Node `16.17.1` / V8 `10.8` |
| 目标架构 | **win32-ia32 + win32-x64 双架构**（已确认） |
| 主进程模块格式 | **CommonJS（CJS）**——Electron 22 主进程不支持 ESM |
| 渲染进程构建目标 | `chrome108` |
| 系统最低要求 | Windows 7 **SP1** + 指定补丁（见 §4） |
| 32 位内存上限 | 32 位 OS 上 **约 2GB**（LAA 后 64 位 OS 约 4GB） |

> ⚠️ **Electron 22 已 EOL（2023-05 停止维护）**，无安全更新。这是为满足 Win7 的
> 必然代价，必须在 ADR-001 中记录并接受。

## 2. Electron 版本边界（已核实）

- **Electron 22** 是最后一个支持 Windows 7/8/8.1 的大版本（官方博文
  *Farewell, Windows 7/8/8.1*）。Electron 23 起基于 Chromium 110，不再支持。
- Electron 22 最终版本为 **22.3.27**（2023-10 发布），此后 22.x 停止支持。
- **32 位（win32-ia32）**：Electron 长期提供 ia32 构建，直到 **Electron 44** 才移除
  （官方 breaking change：*Removed: Windows 32-bit (ia32)*）。因此 Electron 22 同时
  满足「Win7」与「32 位」，是唯一交集。
- Electron 22 的 ia32 产物包含 `electron-v22.3.27-win32-ia32.zip`，可正常打包。

**推论**：不要升级 Electron；不要使用要求 Electron ≥ 23 的 electron-vite 生态新特性。

## 3. 原生模块兼容矩阵

原生模块（`.node`）必须同时满足：**有 win32-ia32 二进制** 且 **兼容 Electron 22 的 ABI/Node ABI**。

| 依赖 | 类型 | 32 位/Win7 风险 | 结论 / 替代 |
| --- | --- | --- | --- |
| `better-sqlite3` **9.6.0** | 原生（自编译） | 已实测通过 | ✅ **采用**；需 `electron-rebuild -a ia32/x64` |
| `serialport` **12.0.0** | N-API 原生 | 已实测通过 | ✅ **采用**；自带 `win32-ia32`/`win32-x64` 预编译，无需重编译 |
| `usb` 2.14 | 原生（node-gyp-build） | 高：32 位预编译不确定，需本地编译 | 优先 **移除**，用 `SerialPort.list()` + WebUSB(`navigator.usb`) 替代插拔监听 |
| `@pdftron/pdfnet-node` 11.1 | 原生（PDFNet） | 高：官方以 x64 为主，授权+体积大 | **移除**（现有 `src` 中未被引用） |
| `@swc/core` | 原生（构建期） | 低：仅开发机使用 | 保留；若需在 32 位开发机构建再评估 |
| `typeorm` / `reflect-metadata` | 纯 JS | 无 | 保留（数据层，见 ADR-002） |
| `docxtemplater` / `pizzip` / `image-size` | 纯 JS | 无 | 保留 |
| `docx-preview` / `html2canvas` | 纯 JS（浏览器） | 无 | 保留（注意 32 位内存，见 §6） |
| `axios` / `qs` / `crypto-js` / `lodash` / `moment` | 纯 JS | 无 | 保留 |
| `electron-log` 5 | 纯 JS | 无 | 保留 |
| `electron-updater` 6 | 纯 JS | 无（但需确认与 Electron 22 兼容） | 保留，验证 |
| `electron-store` **8.2.0** | 纯 JS（CJS） | 无 | ✅ **采用**（v10 ESM-only，Electron 22 主进程 CJS 不可用） |
| `uuid` **11** | 纯 JS | 中：可能 ESM-only | 降级 `uuid` 8/9，或用 `crypto.randomUUID` |
| `pinia` / `vue-router` / `element-plus` | 纯 JS（渲染进程） | 无（Vite 打包） | 保留 |

> **行动项**：维护一份 `dependencies` 黑名单，禁止引入无 ia32 预编译的原生模块。

### 3.1 实测结果（2026-09，本机 x64 Windows）

| 模块 | Electron | Node | ABI(modules) | arch | 结果 |
| --- | --- | --- | --- | --- | --- |
| better-sqlite3 9.6.0 | 22.3.27 | 16.17.1 | 110 | x64 | ✅ 建表/插入/查询正常 |
| better-sqlite3 9.6.0 | 22.3.27 | 16.17.1 | 110 | **ia32** | ✅ 建表/插入/查询正常 |
| serialport 12.0.0 | 22.3.27 | 16.17.1 | 110 | x64 | ✅ 加载 + `list()` 正常 |
| serialport 12.0.0 | 22.3.27 | 16.17.1 | 110 | **ia32** | ✅ 加载 + `list()` 正常 |

验证方式：`scripts/verify-native.cjs`（用 Electron 运行时执行）。
打包验证：`electron-builder --dir --ia32` 与 `--x64` 产物均可启动，原生模块已解包到
`resources/app.asar.unpacked`。

### 3.2 开发机 Node 版本说明（重要）

「32 位」与「Node 版本」是两个独立维度：

- 应用运行时 Node 由 **Electron 22 内置（16.17.1 / N-API 8）** 决定，与开发机 Node 无关。
- 开发机 Node（本机 22.x）仅用于跑构建工具（Vite 5 / electron-builder / tsc）。
- 原生模块必须针对 **Electron 22 的 ABI（modules=110）** 编译，架构由 `-a ia32|x64` 指定；
  宿主 Node 22 只负责执行编译。
- 若直接 `pnpm install` 而不在 Electron 目标下 rebuild，会得到 Node 22 ABI 的 `.node`，
  在应用中报 `NODE_MODULE_VERSION mismatch` —— 因此必须执行 `electron-rebuild`。
- 建议开发机固定 Node 18 LTS（`.nvmrc` 已提供）以规避老工具链兼容问题；Node 22 亦可。

## 4. Windows 7 运行环境要求

现场机器需满足以下条件，安装包应在安装前检测并提示：

| 要求 | 说明 |
| --- | --- |
| Windows 7 **SP1** | 不带 SP1 无法运行 Chromium 108 |
| KB4474419 | SHA-2 代码签名支持（2021 后签名软件必需） |
| KB4490628 | 服务栈更新（配合 SHA-2 补丁） |
| KB3063858 / KB2533623 | 部分 API（`SetDefaultDllDirectories` 等）依赖 |
| VC++ 2015-2022 运行库（x86） | Chromium 运行必需；安装包应内置或静默安装 |
| 设备驱动 | CH341（血压计）、VGA2USB（Epiphan），由用户按操作系统位数自行安装（本应用不再负责安装/维护） |

> 驱动不再由本应用安装，安装包无需内置驱动。32 位应用运行在 64 位 Win7 上时走 WoW64，
> 仍是 32 位进程；如需安装驱动，请按**操作系统位数**安装对应驱动（x64 OS 装 x64 驱动）。

## 5. 数据层备选方案（SQLite）

因 `sqlite3` / `better-sqlite3` 均为原生模块，32 位 + Electron 22 存在编译风险。
按优先级排列：

1. **better-sqlite3**（推荐）：同步 API、性能好，确认有 `electron-v22-win32-ia32` 预编译；
   若官方无预编译，用 `@electron/rebuild` 本地编译 ia32。
2. **sqlite3 5.x（N-API）**：N-API 跨 ABI 稳定，尝试 `prebuild-install` 拉取 ia32。
3. **sql.js（WASM）**：无原生依赖、天然 32 位安全；但需手动持久化、性能与内存较差。
   作为「无论如何都能跑」的兜底方案。
4. 直接调用系统/随包分发的 `sqlite3.dll`（x86），用 `ffi-napi` 封装——不推荐，维护成本高。

> 决策见 ADR-002。

## 6. 32 位内存限制的对策

32 位进程地址空间有限（32 位 OS ≈ 2GB，64 位 OS 大地址感知 ≈ 4GB），而 B 超图片以
base64 形式在内存中多次复制，极易 OOM。

对策（重构必须落实）：

- 图片采集后**立即转 Buffer/Blob**，避免多处保存 base64 字符串。
- 报告生成、预览、上传**串行处理**，处理完显式释放引用。
- 限制单张图片分辨率与 JPEG 质量（采集时按需缩放）。
- 避免在渲染进程长期保留全部历史图片；历史图片按需从磁盘/DB 懒加载。
- 大文件（报告图片）上传改为流式，避免 `otherReportStr` 全量驻留。
- 监控 `process.memoryUsage()`，在主进程记录告警日志。

## 7. 图形/GPU 相关

- Chromium 108 在 Win7 上的 GPU 支持有限（D3D11 可用性差）。
- 保留现有 `app.commandLine.appendSwitch('no-sandbox')`（Win7 沙箱兼容问题）。
- 若出现白屏/花屏，回退软件渲染：`app.disableHardwareAcceleration()` 或
  `--disable-gpu`。应做成可按配置开关，便于现场排障。
- 视频采集走 `getUserMedia`，依赖 VGA2USB 的 DirectShow 驱动；驱动缺失时必须给出明确提示。

## 8. 代码签名与更新

- Win7 要求 SHA-2 签名；无签名安装/更新会触发 SmartScreen 警告（可接受但需告知现场）。
- `electron-updater` 的签名校验（`publisherName`）如需启用，必须配置 SHA-2 证书。
- 建议先以「无签名 + 手动升级兜底」交付，签名作为后续项。

## 9. 验证清单（每个里程碑必须执行）

| 编号 | 验证项 | 通过标准 |
| --- | --- | --- |
| V1 | 32 位 Win7 SP1 安装/启动 | 可安装、可启动、登录页正常 |
| V2 | 64 位 Win7 上运行 32 位包 | 正常 |
| V3 | 血压计串口 | 能枚举 `1A86:7523`、读取数据 |
| V4 | VGA2USB 采集 | 能枚举设备、预览、采集 |
| V5 | 报告生成/预览 | 生成 docx 并转图成功 |
| V6 | 本地 SQLite 读写 | 新增/查询/补传正常 |
| V7 | 上传服务器 | 成功/失败降级均正确 |
| V8 | 内存压测 | 连续采集 20 张、生成 10 次报告不 OOM |
| V9 | 自动更新 | 检查/下载/安装流程可用 |
| V10 | 驱动 | 本应用不再负责；由用户按采集卡型号自行安装 |

## 10. 核实记录

| 日期 | 结论 | 来源 |
| --- | --- | --- |
| 2026-09 | Electron 22 为最后支持 Win7/8/8.1 的大版本 | electronjs.org 博文 *Farewell, Windows 7/8/8.1* |
| 2026-09 | Electron 22.3.27 提供 win32-ia32 产物 | electron v22.3.27 release |
| 2026-09 | Electron 44 才移除 win32-ia32 | electron breaking changes / PR #51816 |
| 2026-09 | better-sqlite3 9.6.0 / serialport 12.0.0 在 Electron 22 ia32+x64 均可用 | 本机实测（见 §3.1） |
| 2026-09 | 应用启动 + ia32/x64 打包产物启动成功 | `electron-builder --dir` 实测 |
| 2026-09 | **x64 与 ia32 NSIS 安装包均成功产出并启动** | `electron-builder --win --x64/--ia32` 实测 |
| 2026-09 | better-sqlite3 预编译（electron v110）可经 prebuild-install 获取 | 缓存命中，无需 VS |
