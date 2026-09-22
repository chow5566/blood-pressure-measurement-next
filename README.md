# 血压及B超检测（重构版）

> 本项目用于对 `blood-pressure-measurement` 进行重构。
> 当前阶段：**功能重构已完成**（Electron 22.3.27，支持 Win7 + 32/64 位）；待现场真机与真实服务端联调。

## 快速开始

```bash
pnpm install          # 需 .npmrc 中 node-linker=hoisted
pnpm dev              # 开发
pnpm build:win64      # 构建 64 位安装包（含原生模块重建）
pnpm build:win32      # 构建 32 位安装包
```

> 原生模块（better-sqlite3）按 arch 重建，详见 [docs/08-build-release.md](docs/08-build-release.md)。

## 当前进度

| 里程碑 | 状态 |
| --- | --- |
| M0 立项与文档 / 选型冻结 | ✅ |
| M1 工程骨架（构建、日志、配置、窗口、IPC、双架构打包） | ✅ |
| M2 数据层 + 存储迁移 + 类型化 IPC + 存储管理 UI | ✅ |
| M3 血压测量（设备层 / 协议 / 业务 / UI 零回归） | ✅ |
| M4 B超采集与报告（视频/表单/报告/历史） | ✅ |
| M5 登录 / 设置 / 驱动 / 更新 / 在线同步 | ✅ |
| M6 硬化与交付（NSIS/体积/空间守卫/错误兜底/文档） | ✅ |
| 真机与真实服务端联调 | ⬜ 待现场 |


## 重构目标

1. **必须支持 Windows 7（SP1）** —— 现场存在大量 Win7 机器无法升级。
2. **必须支持 32 位（ia32 / x86）** —— 现场存在 32 位 Win7 机器。
3. **安装时可选数据存储目录**，且本地重要数据（SQLite、图片、报告）可在应用内迁移换盘。
4. **后端接口不允许修改** —— 所有接口、字段、鉴权契约保持不变。
5. 在保持现有业务能力（血压测量、B超采集、报告生成、数据上传）不变的前提下，改善：
   - 原生依赖在 Win7 / 32 位下的兼容性与可安装性；
   - 代码分层与可维护性；
   - 构建与发布流程的可重复性。

## 视觉基线

**血压测量界面与字体（DSEG7 数字字体）作为视觉基准冻结，重构中零回归**；
其余页面在统一设计系统下优化布局。详见 [docs/11-ui-design.md](docs/11-ui-design.md)。

## 硬约束（不可违反）

| 约束 | 说明 |
| --- | --- |
| Win7 SP1 + 32 位 | 见 [docs/02-compatibility.md](docs/02-compatibility.md) |
| 后端接口冻结 | 不改接口、不改字段、不改鉴权 |
| 血压页视觉冻结 | 样式/字体/比例不改 |
| 技术栈自定 | 但必须服从以上约束 |

## 新项目技术栈（已锁定）

| 维度 | 选型 |
| --- | --- |
| 桌面框架 | **Electron 22.3.27**（Chromium 108 / Node 16.17.1，支持 Win7） |
| 构建 | electron-vite 2.3.0 + Vite 5 + TypeScript（target: node16/chrome108） |
| UI | Vue 3 + Vue Router + Pinia + Element Plus（按需引入）+ Tailwind（仅工具类，风格 A · 医疗清新） |
| 本地库 | **better-sqlite3 9.6.0** + 自建 migration（需按 arch rebuild） |
| 设备 | serialport 12（自带 ia32/x64 预编译）；插拔用轮询，无 `usb` 原生依赖 |
| 文件 | fs-extra |
| 配置/日志 | electron-store 8 / electron-log 5 |
| 更新 | electron-updater + electron-builder(NSIS) |
| 架构 | **win32-ia32 + win32-x64 双包**；运行时**单窗口 + 应用内弹窗** |

## 原项目技术栈（迁移参考）

| 维度 | 现状 |
| --- | --- |
| 桌面框架 | Electron 31 |
| 构建 | electron-vite 2 + Vite 5 + TypeScript |
| UI | Vue 3 + Vue Router + Pinia + Element Plus + Tailwind |
| 本地库 | TypeORM + sqlite3 |
| 设备 | serialport（血压计）、usb（插拔）、VGA2USB 采集卡（B超视频） |
| 报告 | docxtemplater + pizzip + docx-preview + html2canvas |
| 更新 | electron-updater + electron-builder(NSIS) |

> Electron 31 **不支持 Win7**，因此重构下降 Electron 版本，详见
> [docs/02-compatibility.md](docs/02-compatibility.md)。

## 关键约束（先读这两个）

- [docs/02-compatibility.md](docs/02-compatibility.md) —— Win7 / 32 位兼容性约束与原生依赖矩阵
- [docs/07-refactor-plan.md](docs/07-refactor-plan.md) —— 重构计划与里程碑

## 文档目录

| 文档 | 说明 |
| --- | --- |
| [docs/00-overview.md](docs/00-overview.md) | 项目概述、范围、名词约定 |
| [docs/01-current-modules.md](docs/01-current-modules.md) | 现状功能模块与代码结构梳理 |
| [docs/02-compatibility.md](docs/02-compatibility.md) | Win7 / 32 位兼容性约束、原生依赖矩阵 |
| [docs/03-architecture.md](docs/03-architecture.md) | 目标架构设计 |
| [docs/04-tech-stack.md](docs/04-tech-stack.md) | 技术选型（锁定版本） |
| [docs/05-data-model.md](docs/05-data-model.md) | 数据模型与本地存储 |
| [docs/06-ipc-protocol.md](docs/06-ipc-protocol.md) | 主进程/渲染进程 IPC 协议 |
| [docs/07-refactor-plan.md](docs/07-refactor-plan.md) | 重构计划、里程碑、任务拆分 |
| [docs/08-build-release.md](docs/08-build-release.md) | 开发、构建、打包、签名、发布 |
| [docs/09-risks-decisions.md](docs/09-risks-decisions.md) | 风险清单与技术决策记录（ADR） |
| [docs/10-storage-and-migration.md](docs/10-storage-and-migration.md) | 数据存储目录选择与数据迁移 |
| [docs/11-ui-design.md](docs/11-ui-design.md) | 布局重构与视觉规范（保留血压界面） |
| [docs/12-troubleshooting.md](docs/12-troubleshooting.md) | 现场排障手册 |
| [docs/13-delivery-checklist.md](docs/13-delivery-checklist.md) | 交付检查清单 |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 文档变更记录 |

## 待办

- [x] Electron 版本与原生模块方案（ADR-001 / ADR-002 / ADR-003）
- [x] 交付架构：32 位 + 64 位双包（ADR-007）
- [x] 数据存储与迁移细节（ADR-008）
- [x] UI 风格：A · 医疗清新（ADR-010）
- [x] 工程骨架搭建（M1）
- [x] M2–M6 功能（数据层 / 血压 / B超 / 登录 / 设置 / 驱动 / 更新 / 存储迁移）
- [ ] 现场真机与真实服务端联调
- [ ] 放置 32 位驱动安装包 `resources/drivers/vga2usb/V2UInstaller32.msi`
- [ ] 文档同步：`docs/06-ipc-protocol.md` 等仍记录旧通道
