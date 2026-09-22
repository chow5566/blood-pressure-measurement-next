# 04 · 技术选型（锁定版本）

> 版本以「满足 Win7 + 32 位」为前提。除特别说明外，均**锁定**，升级须走 ADR。

## 1. 运行时框架

| 依赖 | 版本 | 理由 |
| --- | --- | --- |
| `electron` | **22.3.27** | 最后支持 Win7/8/8.1 的版本；含 win32-ia32 |
| Node（开发机） | 18 LTS（≥18.12） | electron-vite 2 / Vite 5 要求；仅构建期 |
| Node（运行时） | 16.17.1（Electron 内置） | 无需单独安装 |

## 2. 构建工具链

| 依赖 | 版本 | 理由 |
| --- | --- | --- |
| `electron-vite` | `^1.0.29` 或 `^2.x`（需验证 Electron 22） | 主/预加载/渲染三段式构建 |
| `vite` | 与 electron-vite 匹配（4 或 5） | 见 ADR-003 |
| `typescript` | `^5.x` | 类型与工具链 |
| `@vitejs/plugin-vue` | 匹配 `vue` | SFC 支持 |
| `@swc/core` | 与 electron-vite 匹配 | 主进程 TS 快速编译 |
| `vue-tsc` | 匹配 `vue` | 类型检查 |
| `electron-builder` | `^24.x`（确认支持 Electron 22 ia32/x64） | NSIS 打包、ia32 + x64 目标 |
| `@electron/rebuild` | 最新兼容版 | 原生模块 ia32/x64 重编译 |

> 注意：electron-builder 会分别下载 `electron-v22.3.27-win32-ia32.zip` 与
> `electron-v22.3.27-win32-x64.zip`。**双架构已确认**，两套原生模块都要可用。
> 建议配置镜像 `https://npmmirror.com/mirrors/electron/`（沿用现状）。

## 3. 渲染进程

| 依赖 | 版本 | 备注 |
| --- | --- | --- |
| `vue` | `^3.4` | 支持 Chromium 108 |
| `vue-router` | `^4` | hash 模式（`createWebHashHistory`） |
| `pinia` | `^2.2` | + `pinia-plugin-persistedstate` |
| `element-plus` | `^2.8` | **按需引入**（unplugin-vue-components + unplugin-auto-import） |
| `@element-plus/icons-vue` | `^2.3` | |
| `unplugin-auto-import` | `^0.18` | Element Plus API（ElMessage 等）按需 + 类型声明 |
| `unplugin-vue-components` | `^0.27` | Element Plus 组件按需 + 类型声明 |
| `tailwindcss` | `^3.4` | 构建期 |
| `sass` | `^1.77` | 构建期 |
| `axios` | `^1.7` | |
| `qs` | `^6.13` | |
| `crypto-js` | `^4.2` | |
| `lodash` | `^4.17` | 建议按需引入 |
| `moment` | `^2.30` | 可考虑替换为 `dayjs`（非必须） |
| `docx-preview` | `^0.3` | 报告预览 |
| `html2canvas` | `^1.4` | 报告转图 |
| `tailwindcss` | `^3.4` | 仅 utilities（不含 preflight） |
| `uuid` | 见 ADR-005 | 尽量用 `crypto.randomUUID` |
| `driver.js` | `^1.3` | 新手引导（如保留） |

**渲染进程构建目标**：`build.target = 'chrome108'`，确保不产出更高版本语法。

## 4. 主进程

| 依赖 | 版本 | 备注 |
| --- | --- | --- |
| `@electron-toolkit/preload` | `^3` | |
| `@electron-toolkit/utils` | `^3` | |
| `reflect-metadata` | `^0.2` | TypeORM 装饰器（如采用 TypeORM） |
| `typeorm` | `^0.3.17` | 数据层（可评估直接用 better-sqlite3，见 ADR-002） |
| `better-sqlite3` | **`9.6.0`** | ✅ 已实测 Electron 22 ia32/x64 可用；需 `electron-rebuild` |
| `serialport` | **`12.0.0`** | ✅ N-API，自带 ia32/x64 预编译，无需重编译 |
| `usb` | **移除（优先）** | 见 ADR-006，改 WebUSB/串口枚举 |
| `docxtemplater` | `^3.55` | 报告生成 |
| `docxtemplater-image-module-free` | `^1.1` | 图片模块 |
| `pizzip` | `^3.1` | docx zip |
| `image-size` | `^1.1` | 图片尺寸 |
| `axios` | `^1.7` | 上传客户端（主进程） |
| `fs-extra` | `^11.2` | 文件操作（复制/移动/删除/目录），迁移与存储使用 |
| `electron-log` | `^5.2` | 日志 |
| `electron-store` | **`^8.x`** | **不可用 v10（ESM-only）** |
| `electron-updater` | `^6.1` | 自动更新 |
| `crypto-js` | `^4.2` | 登录密码加密（沿用旧算法） |
| `electron-updater` | `^6.1` | 自动更新，需验证 Electron 22 |
| `@pdftron/pdfnet-node` | **移除** | 未被引用（P3） |

## 5. 明确移除的依赖

| 依赖 | 原因 |
| --- | --- |
| `@pdftron/pdfnet-node` | 无引用、体积大、x64 为主、授权风险 |
| `usb` | 32 位预编译不确定；可用 WebUSB/串口枚举替代 |
| `fontkit` | 若无实际使用则移除（待确认；疑似报告字体计算遗留） |

## 6. 开发规范工具

| 工具 | 版本 |
| --- | --- |
| `eslint` | `^8` |
| `prettier` | `^3` |
| `@vue/eslint-config-*` | 匹配 |
| `unplugin-auto-import` | `^0.18` |
| `unplugin-vue-components` | `^0.27` |
| `vite-plugin-svg-icons` | `^2` |

> 建议在重构中**逐步移除 auto-import 魔法**，改为显式 import，提升可读性与类型可追溯性。
> 若保留，必须在 `tsconfig` 中正确声明，避免 `ElMessage` 等未定义告警。

## 7. 版本管理建议

- 使用 `pnpm`（与现状一致），提交 `pnpm-lock.yaml`。
- **`.npmrc` 必须设置 `node-linker=hoisted`**：pnpm 默认的符号链接布局会导致
  electron-builder 依赖树收集不全（实测报 `Cannot find module 'ajv/dist/compile/codegen'`）。
- 在 `package.json` 增加 `engines` 与 `packageManager` 字段。
- 原生模块版本在 ADR 中逐一登记并给出 ia32 验证结果。

## 8. 已冻结版本（M1 实测）

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| electron | 22.3.27 | Win7 + ia32/x64 |
| electron-vite | 2.3.0 | 与 Electron 22 兼容 |
| vite | 5.4.21 | 构建期 |
| electron-builder | 24.13.3 | ia32/x64 打包 |
| @electron/rebuild | 3.7.2 | 原生模块重建 |
| better-sqlite3 | 9.6.0 | 已实测 |
| serialport | 12.0.0 | 已实测 |
| electron-store | 8.2.0 | CJS |
