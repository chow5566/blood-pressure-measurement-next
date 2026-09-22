# 文档变更记录

## 2026-09-21 · 界面重构与功能补齐

- 设计方向：**精密栅格**（零圆角、发丝线、单一绿强调、暗色主题）；统一按钮/输入/单选/表格/对话框/滚动条。
- 导航：按域聚合为 Tab 容器（血压：检测/历史；B超：采集/历史/模板维护），侧栏简化。
- 血压：测量卡恢复拟物化（DSEG7 数码管，暗色适配）；空态精简；开发环境“模拟设备”预览两台。
- B超：模板维护（树增删改 + 获取公共模板）；历史就地编辑全部字段（含改条码）、图片弹框编辑、
  报告预览（图片）、上传状态角标、批量上传进度弹框、同步覆盖确认。
- 报告：图片统一转 PNG（模块固定 `.png`）、支持服务器图片；修复 CSP 未放行 `blob:` 导致的图片裂图。
- 修复：IPC 结构化克隆报错（响应式代理）；图片分批保存（`bscan:clear-images` / `bscan:save-images`）；
  偏好持久化（体检类型/默认勾选/联网使用/报告标题/快捷键/滤镜）；血压历史排序；开发环境跳过自动更新检查。
- 校验：typecheck / lint 全绿。

## 2026-09-18 · M6 硬化与交付

- 安装：NSIS 自定义页选择数据目录（`build/installer.nsh`），写入 HKLM；主进程首启读取注册表
  并采纳为 `dataDir`。
- 存储：`checkDataSpace` / `assertSpaceForWrite`（硬阈值阻止写入），血压/B超保存前守卫；
  bootstrap 定时低空间预警（`storage:low-space`）。
- 稳定性：主进程 uncaughtException / unhandledRejection / render-process-gone / child-process-gone；
  渲染层 errorHandler / unhandledrejection / window.error。
- 体积：electron-builder `files` 裁剪非 Windows 预编译、`bin`/`deps`/`src`、测试与调试文件、sourcemap。
- 文档：新增 `12-troubleshooting.md`（现场排障）、`13-delivery-checklist.md`（交付清单）。
- NSIS：`installer.nsh` 修正为「Page custom + Function」正确结构（在 Function 内运行 nsDialogs/
  MUI_HEADER_TEXT），已通过 NSIS 编译。
- 构建：`win.target` 不再固定 arch（由 CLI `--x64`/`--ia32` 决定），避免双架构共用同一原生模块。
- 原生重建：新增 `scripts/rebuild-native.cjs`（预编译优先 + electron-rebuild 兜底）。
- 验证：build / typecheck / lint 全绿；**x64 与 ia32 安装包均成功产出并启动正常**。

## 2026-09-18 · M5 登录 / 设置 / 驱动 / 更新 / 在线同步

- 配置：主进程 `electron-store` 增加 `baseApi/staticApi/token/username/renderMode`；
  IPC `config:get|update`（不下发 token 明文）；渲染层 `config` store 同步。
- 登录：`domain/auth`（AES-ECB-Pkcs7 密码加密，密钥随 baseApi 变化）；
  IPC `auth:login|logout`；登录页 + 离线使用；启动自动进入（有 token）。
- 驱动：`infra/hardware/driver`（msiexec 静默安装/卸载，按 OS 位数选包，超时与错误反馈，
  修复 I5）；IPC `driver:status|install|uninstall`；设置页驱动区块。
- 更新：`infra/update`（electron-updater + generic），状态事件 `update:status`；
  IPC `update:check|download|install|status`；设置页更新区块。
- 在线同步：`domain/b-scan/online`（公卫/商业按条码查询 + 图片下载转 base64）；
  IPC `bscan:online-lookup`；FormView 联网合并、历史「同步数据」。
- 渲染模式：启动前按配置 `disableHardwareAcceleration()`（Win7 排障）。
- 布局：新增登录门控、设置页，顶部导航含在线/离线状态与退出。
- 资源：复制 `resources/drivers`（**当前为占位文件，交付前替换真实 MSI**）。
- 验证：build / typecheck / lint 全绿；`--self-test` 通过；updater 成功初始化。

## 2026-09-18 · M4 B超采集与报告

- 报告：`domain/b-scan/report.ts`（docxtemplater + image-module-free + pizzip + image-size），
  模板路径 dev/packaged 自适应；输出 docx dataURL。
- 图片：`domain/b-scan/image-store.ts` 落盘到 `<dataDir>/images/<barcode>/<uuid>.<ext>`，
  DB 只存 `localPath`，读取时回填 base64。
- 业务：`domain/b-scan/service.ts` 保存/查询/分页/删除/上传/模板；上传 content 沿用旧契约。
- 上传：`infra/http/uploader.ts` 泛化为 `uploadHealthData`（BP/BSCAN）。
- IPC：`bscan:render-report|save|get|page-list|upload|delete|templates`。
- 渲染层：`VideoView`（采集/滤镜/快捷键）、`FormView`（患者+检查+模板）、`PicView`
  （预览/删除/勾选）、采集页、历史页；`utils/docx.ts` 报告转图。
- 组件/状态：Pinia `b-scan`/`user`/`settings`；Tailwind 工具类；Element Plus 按需。
- 自检：新增 `--self-test`（真实跑保存→查询→图片→报告→列表→删除），已通过。
- 报告链路验证：`scripts/verify-report.cjs` 通过（生成 24KB docx）。

## 2026-09-18 · M3 血压测量

- 设备层：`infra/hardware/serial/bp-device.ts`，仅管理 VID `1A86`/PID `7523` 血压计；
  插拔检测改为**轮询** `SerialPort.list()`（移除原生 `usb`，ADR-006 落地）。
- 协议：`domain/blood-pressure/protocol.ts` 固定指令 + 帧解析（错误/临时/结果）；
  指控常量迁到 `shared/domain/blood-pressure.ts` 供渲染层复用。
- 业务：`domain/blood-pressure/service.ts` 一次测量「先落库再上传，成功标记 status=1」。
- 上传：`infra/http/uploader.ts`（axios）沿用后端契约（`dataType/dataContent`+`token`，
  成功判定 `code===0`）。
- IPC：新增 `bp:list-ports` / `bp:open` / `bp:send` / `bp:close-all` / `bp:record`，
  事件 `bp:data` / `bp:devices`。
- 渲染层：**血压界面零回归迁移**（`BloodPressureCard.vue` + `ModernFontView.vue` +
  `LinkLoadingView.vue`），DSEG7 字体；新增 Vue Router（页内切换）与 Pinia；
  Tailwind 工具类（仅 utilities，无 preflight）。
- 启动实测：血压桥接初始化正常，应用无异常。

## 2026-09-18 · M2 数据层 / 存储迁移 / 类型化 IPC

- 数据层：better-sqlite3 + 自建 migration runner（ADR-012），4 类仓库，旧库基线兼容。
  实测旧库（6 B超记录 / 17 图片 / 57 模板）完整，`integrity_check=ok`。
- 存储：磁盘信息（PowerShell/wmic，Win7 兼容）、目录布局、目标校验（仅本地固定磁盘）、
  迁移服务（复制→校验→切换→删除旧数据→自动重启）+ 维护模式。
- IPC：类型化契约 + 通道白名单（`shared/ipc.ts`、`ipc/registry.ts`），app/storage 模块。
- 渲染层：单窗口壳 + 存储管理面板（风格 A · 医疗清新），Element Plus 按需引入。
- 启动体验（ADR-013）：单窗口架构、`backgroundColor`+`ready-to-show` 防白屏、
  `index.html` 内联 HTML 闪屏、Element Plus 按需引入。
- 依赖：新增 `fs-extra`、`element-plus`、`unplugin-*`；`@electron/node-gyp` 用 pnpm
  overrides 固定到 registry 版本（避免 git+ssh 拉取失败）。
- 新增 ADR-012（数据层）、ADR-013（单窗口）。

## 2026-09-18 · M1 工程骨架完成

已搭建并实测工程骨架：

- Electron **22.3.27**（Chromium 108 / Node 16.17.1）锁定。
- electron-vite 2.3.0 三段式构建，target `node16` / `chrome108`。
- 最小可运行应用：主进程 + preload(contextBridge) + Vue 渲染页 + IPC（ping/app-info/storage-info）。
- 基础设施：`electron-log` 日志、`electron-store` 配置、数据目录解析（默认
  `%ProgramData%\<appName>\data` + 旧目录探测）、窗口管理、引导期同步日志。
- 双架构打包：`asarUnpack: '**/*.node'`、NSIS 自定义脚本占位、ia32+x64 脚本。
- **原生模块实测**：`better-sqlite3@9.6.0`、`serialport@12.0.0` 在 Electron 22.3.27
  ia32 与 x64 下均正常；打包产物（--dir）x64/ia32 均启动成功。
- **关键修复**：`.npmrc` 改为 `node-linker=hoisted`，解决 electron-builder 打包后
  `Cannot find module 'ajv/dist/compile/codegen'`。
- ADR-002（better-sqlite3）、ADR-003（electron-vite 2.3.0）、ADR-011（pnpm 布局）落定。
- 澄清：开发机 Node 22 与「32 位/运行时 Node 16」无关，见 `02-compatibility.md §3.2`。

## 2026-09-18 · 决策确认（存储/架构/字体/接口）

根据反馈确认并落档：

- 数据目录：**安装时可 + 应用内可改**；迁移成功后**删除旧数据**并**自动重启**。
- 存储介质：**禁止** U盘/移动硬盘/网络盘，仅本地固定磁盘。
- 交付架构：**32 位 + 64 位双包**（ADR-007 更新）。
- 字体：UI 中文用**系统微软雅黑**，不内置。
- 数据量：每天 ≤500 条、3~7 图/条、图片**可适度压缩**（新增容量估算）。
- 加密：**不做**；自动更新：**保留，沿用现状**。
- 后端接口：**冻结不修改**（ADR-009）。
- UI 风格：**已选 A · 医疗清新**（ADR-010），规范见 `11-ui-design.md` §8。

更新文件：`02/04/07/08/09/10/11` 与 `CHANGELOG`。

## 2026-09-18 · M0 补充需求（存储迁移 + 布局重构）

新增需求并更新文档：

- 新增 [`10-storage-and-migration.md`](10-storage-and-migration.md)：安装时选择数据目录、
  应用内更换目录、SQLite + 图片 + 报告安全迁移、盘满保护、旧数据自动发现。
- 新增 [`11-ui-design.md`](11-ui-design.md)：布局重构与设计系统；**血压测量页与
  DSEG7 字体冻结**，其余页面统一改造；记录血压页完整视觉规格。
- 硬约束补充：**后端接口不允许修改**（ADR-009）。
- 更新 `00-overview.md`（目标 G6~G8、非目标、范围）。
- 更新 `05-data-model.md`（数据目录以 `dataDir` 为唯一真相）。
- 更新 `06-ipc-protocol.md`（服务桥通道、storage 通道）。
- 更新 `08-build-release.md`（NSIS 自定义数据目录选择页）。
- 更新 `09-risks-decisions.md`（ADR-008 存储迁移、ADR-009 接口冻结；R11~R14；Q7~Q14）。

## 2026-09-18 · M0 初始化

- 创建重构项目目录骨架（`blood-pressure-measurement-next`）。
- 编写文档：
  - `00-overview.md` 项目概述
  - `01-current-modules.md` 现状模块梳理
  - `02-compatibility.md` Win7 / 32 位兼容性约束（核心）
  - `03-architecture.md` 目标架构
  - `04-tech-stack.md` 技术选型
  - `05-data-model.md` 数据模型
  - `06-ipc-protocol.md` IPC 协议
  - `07-refactor-plan.md` 重构计划
  - `08-build-release.md` 构建发布
  - `09-risks-decisions.md` 风险与 ADR
- 结论：锁定 Electron 22.3.27；待实测原生模块 ia32 可行性。

## 模板（后续更新请复制）

```
## YYYY-MM-DD · <里程碑/主题>

- 变更内容 1
- 变更内容 2
- 影响/结论
```
