# 08 · 开发、构建、打包与发布

## 1. 开发环境

| 项 | 要求 |
| --- | --- |
| 操作系统 | 建议 x64 Win10/11 开发机 |
| Node | 18 LTS（推荐，`.nvmrc` 已提供）；Node 22 亦可 |
| 包管理 | pnpm（**必须 `.npmrc` 设置 `node-linker=hoisted`**） |
| 原生编译 | Python 3 + VS Build Tools（含 C++、Windows SDK） |
| Electron 镜像 | `https://npmmirror.com/mirrors/electron/` |

> 32 位/64 位产物可在 x64 开发机上编译；但**原生模块需按 arch 分别 rebuild**
> （`better-sqlite3` 非 N-API，ABI 绑定 Electron 22）。

## 2. 常用脚本（已实现）

```jsonc
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "npm run typecheck && electron-vite build",
    "typecheck": "npm run typecheck:node && npm run typecheck:web",
    "lint": "eslint . --ext .js,.ts,.tsx,.vue --fix",
    "rebuild:ia32": "node scripts/rebuild-native.cjs ia32",
    "rebuild:x64": "node scripts/rebuild-native.cjs x64",
    "build:win32": "npm run build && npm run rebuild:ia32 && electron-builder --win --ia32",
    "build:win64": "npm run build && npm run rebuild:x64 && electron-builder --win --x64",
    "build:win": "npm run build && npm run rebuild:x64 && electron-builder --win --x64 && npm run rebuild:ia32 && electron-builder --win --ia32",
    "build:unpack": "npm run build && electron-builder --dir"
  }
}
```

> ⚠️ **不能**用 `electron-builder --win --ia32 --x64` 一次出双包：一次构建只能用 `node_modules`
> 中单一 arch 的原生模块。`electron-builder.yml` 的 `win.target` **不固定 arch**，由 CLI 指定。
>
> **原生模块重建**：`scripts/rebuild-native.cjs` 优先用 `prebuild-install` 拉取与 Electron 匹配的
> 预编译（无需 VS），失败才回退 `electron-rebuild`（需 VS Build Tools）。已实测两架构可用。

## 3. electron-builder 配置要点

```yaml
appId: com.skzx.app
productName: 血压及B超检测
directories:
  buildResources: build
win:
  executableName: 血压及B超检测
  target:
    - target: nsis
      arch: [ia32, x64]   # 双架构已确认
  icon: build/favicon.ico
  electronLanguages: [en-US, zh-CN]
nsis:
  oneClick: false
  perMachine: true
  allowToChangeInstallationDirectory: true
  include: build/installer.nsh   # 自定义数据目录选择页，见 §3.3
  # 32 位系统不支持 requestedExecutionLevel requireAdministrator 的账号控制细节需实测
npmRebuild: false
electronDownload:
  mirror: https://npmmirror.com/mirrors/electron/
publish:
  provider: generic
  url: <更新地址>
```

### 3.3 安装时选择数据目录

- 通过 `nsis.include` 注入自定义页面，让用户选择数据目录（详见
  [10-storage-and-migration.md](10-storage-and-migration.md) §4）。
- 所选目录写入注册表，应用首次启动读取并固化到配置。
- 未选择时默认 `%ProgramData%\<appName>\data`。
- 安装包需同时内置 **x86 与 x64 两套资源**（驱动、VC++ 运行库），运行期按 OS 位数选择。

### 3.1 权限（修正 P6）

- 现状 `requestedExecutionLevel: requireAdministrator` 让整个应用常驻管理员。
- 改为：应用**普通权限**启动；驱动安装时通过 `msiexec` 触发 UAC 提权，或内置提权工具。
- 若因历史原因必须常驻管理员，需在 ADR-004 记录并说明理由。

### 3.2 原生模块打包（已实测）

- `asarUnpack` 包含 `**/*.node`，确保 `.node` 落到 `resources/app.asar.unpacked`。
- `extraResources` 将 `resources/` 复制到 `resources/resources`。
- `npmRebuild: false` 时，必须在打包前用 `electron-rebuild -a ia32` 与 `-a x64` 分别重建两套。
- 实测（2026-09）：`electron-builder --dir --ia32` 与 `--x64` 产物均可启动，
  `better_sqlite3.node` 正确解包。

### 3.3 可选：裁剪体积（M6）

- `@serialport/bindings-cpp/prebuilds` 内含 android/linux/darwin 全部预编译，Windows 包只需
  `win32-ia32` 与 `win32-x64`；可在 `files` 中排除其余目录以减小体积。
- `better-sqlite3` 的 `test_extension.node`、`bin/` 下其他 arch 产物可排除。

## 4. 资源清单

| 资源 | 说明 |
| --- | --- |
| `resources/template/bscan-default.docx` | B超报告模板 |
| `resources/drivers/vga2usb/V2UInstaller64.msi` | x64 驱动（已有） |
| `resources/drivers/vga2usb/V2UInstaller32.msi` | **x86 驱动（缺失，需补）** |
| `build/favicon.ico` | 应用图标 |

## 5. 报告模板路径（修正 P8）

现状：`path.join(__dirname, '../../resources/template/...')`，打包后易失效。
重构：
- 通过 electron-vite 的 `?asset` 机制引用，或
- 将模板放到 `extraResources` 并在运行时用 `process.resourcesPath` 解析。

## 6. 发布

| 项 | 约定 |
| --- | --- |
| 渠道 | generic provider（沿用现状） |
| 产物 | `血压及B超检测-<version>-setup.exe`（NSIS） |
| 升级 | `latest.yml` + 差量/全量 |
| 签名 | 可选（SHA-2）；无签名时 `publisherName` 校验需关闭 |
| 版本号 | 语义化版本，与后端接口兼容性在 CHANGELOG 标注 |

## 7. 小体积与性能

- 移除未使用依赖（PDFTron、fontkit 等）可显著减小体积。
- `electronLanguages` 仅保留 `en-US`、`zh-CN`。
- 渲染产物开启 `minify`、关闭 sourcemap（生产）。

## 8. 排障开关

| 场景 | 手段 |
| --- | --- |
| 白屏/花屏（Win7 GPU） | 设置 `renderMode=software` → `app.disableHardwareAcceleration()` |
| 沙箱异常 | 保留 `--no-sandbox` |
| 日志 | electron-log 输出到 `%APPDATA%\<appName>\logs` |
| 设备不识别 | 提供「设备诊断」页，展示串口/USB/视频设备枚举结果与驱动状态 |
