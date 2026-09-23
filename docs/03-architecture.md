# 03 · 目标架构设计

## 1. 设计原则

1. **兼容优先**：所有选型服从 [02-compatibility.md](02-compatibility.md)。
2. **进程边界清晰**：硬件、文件、数据库、系统调用只在主进程；渲染进程只做 UI 与纯计算。
3. **类型安全**：主进程 100% TypeScript；渲染进程核心逻辑 TypeScript；启用严格模式。
4. **显式 IPC 契约**：IPC 通道集中定义、类型化，禁止散落的字符串通道。
5. **可测试**：硬件与系统调用抽象为接口，便于 mock。
6. **可诊断**：结构化日志 + 现场可开关的软件渲染/调试开关。

## 2. 进程架构

```
┌──────────────────────────────────────────────────────────────┐
│ Renderer (Vue3, Chromium 108)                                 │
│  views / components / stores                                  │
│        │ window.api.xxx()  (contextBridge)                    │
├────────┼───────────────────────────────────────────────────────┤
│ Preload (CJS, contextIsolation: true, sandbox: false)         │
│  contextBridge.exposeInMainWorld('api', typedApi)             │
├────────┼───────────────────────────────────────────────────────┤
│ Main (CJS, Node 16.17)                                        │
│  bootstrap → services → ipc handlers                          │
│   ├─ hardware: serialport / usb / video-device               │
│   ├─ data: sqlite (typeorm) + local file store               │
│   ├─ report: docxtemplater → docx                            │
│   ├─ infra: logger / config / updater / driver-installer      │
│   └─ window: window manager                                   │
└──────────────────────────────────────────────────────────────┘
```

### 安全基线

- `contextIsolation: true`、`nodeIntegration: false`。
- preload 仅暴露白名单方法，不暴露 `ipcRenderer` 原始对象。
- 所有 `ipcMain.handle` 入参做运行时校验（zod 或手写守卫）。
- 禁用任意 URL 导航与新窗口（`setWindowOpenHandler` 拒绝）。
- 应用以普通权限启动（不再需要驱动安装提权，见 ADR-004）。

## 3. 目录结构（建议）

```
src/
├─ main/
│  ├─ index.ts                    # 入口：单实例、生命周期、引导
│  ├─ bootstrap/                  # 初始化编排（db/services/ipc/updater）
│  ├─ config/                     # 应用配置（路径、开关、默认值）
│  ├─ ipc/                        # IPC 注册（按模块拆分）
│  │  ├─ index.ts
│  │  ├─ channels.ts              # 通道常量与类型
│  │  └─ modules/{bp,bscan,settings,window,update,driver}.ts
│  ├─ domain/                     # 业务领域（与 Electron 解耦）
│  │  ├─ blood-pressure/          # 数据解析、校验、业务规则
│  │  ├─ b-scan/                  # 采集、表单、报告参数
│  │  └─ report/                  # 报告生成（docxtemplater）
│  ├─ infra/                      # 基础设施
│  │  ├─ database/                # typeorm datasource + entities + migrations
│  │  ├─ hardware/{serial,usb,video,driver}/
│  │  ├─ http/                    # 上传客户端
│  │  ├─ log/
│  │  ├─ store/                   # electron-store
│  │  ├─ update/
│  │  └─ window/
│  └─ shared/                     # 主/渲染共享类型（IPC DTO）
├─ preload/
│  └─ index.ts
└─ renderer/
   └─ src/
      ├─ api/
      ├─ components/
      ├─ composables/
      ├─ layouts/
      ├─ router/
      ├─ stores/
      ├─ utils/
      └─ views/
```

### 已实现结构（M2）

```
src/
├─ shared/                        # 主/渲染共享（纯类型，无 Node/Electron）
│  ├─ ipc.ts                      # IPC 契约（通道白名单 + 类型）
│  ├─ domain/{common,blood-pressure,b-scan,storage}.ts
│  └─ utils/format.ts
├─ main/
│  ├─ index.ts                    # 入口（单实例、生命周期）
│  ├─ bootstrap/index.ts          # 启动引导（日志→数据目录→数据库→IPC）
│  ├─ config/index.ts             # electron-store 配置（dataDir 指针、旧目录探测）
│  ├─ ipc/
│  │  ├─ registry.ts              # 类型化 handle/broadcast
│  │  ├─ index.ts
│  │  └─ modules/{app,storage}.ts
│  ├─ infra/
│  │  ├─ logger.ts / bootstrap-log.ts / window-manager.ts
│  │  ├─ maintenance.ts           # 维护模式（迁移时冻结写入）
│  │  ├─ database/
│  │  │  ├─ connection.ts         # better-sqlite3 单例 + pragma
│  │  │  ├─ migrations/{types,001-init,index}.ts
│  │  │  ├─ repositories/*.repository.ts
│  │  │  └─ index.ts
│  │  └─ storage/
│  │     ├─ disk.ts               # 磁盘信息/目录大小/Win7 查询
│  │     ├─ storage-paths.ts      # 数据目录布局
│  │     ├─ storage-service.ts    # 信息查询 + 目标校验
│  │     ├─ migration-service.ts  # 迁移流程
│  │     └─ index.ts
│  └─ utils/datetime.ts
├─ preload/index.ts               # contextBridge 白名单 API
└─ renderer/src/
   ├─ main.ts / App.vue           # 单窗口壳（ElConfigProvider 中文）
   ├─ api/{app,storage}.ts        # IPC 封装
   ├─ views/StorageView.vue       # 存储管理面板（风格 A）
   ├─ styles/{variables,base,index}.scss
   ├─ auto-imports.d.ts / components.d.ts   # unplugin 生成
   └─ env.d.ts
```

## 4. 关键抽象（接口化，便于测试与替换）

```ts
// 串口设备
interface BloodPressureDevice {
  list(): Promise<DeviceInfo[]>
  open(info: DeviceInfo): Promise<void>
  send(cmd: Uint8Array): Promise<void>
  onData(cb: (data: Uint8Array) => void): void
  closeAll(): Promise<void>
}

// 视频采集设备
interface VideoCaptureDevice {
  list(): Promise<MediaDeviceInfo[]>
  start(deviceId: string): Promise<MediaStream>
  capture(stream: MediaStream): Promise<Buffer>
  stop(): void
}

// 注：应用不再负责任何驱动的安装/卸载（由用户按采集卡型号自行安装）。

// 本地持久化
interface LocalRepository<T> {
  upsert(entity: T): Promise<void>
  findById(id: string): Promise<T | null>
  query(params: QueryParams): Promise<PageResult<T>>
  markUploaded(id: string, result: UploadResult): Promise<void>
}
```

## 5. IPC 设计

- 使用 `ipcMain.handle` / `ipcRenderer.invoke` 统一 request-response。
- 主 → 渲染的推送（USB 插拔、更新进度）使用命名事件，集中登记。
- 通道命名规范：`<domain>:<action>`，如 `bp:list-ports`、`bscan:render-report`。
- 所有通道定义在 `shared/ipc.ts`，主/预加载/渲染三方共享类型。
- 详见 [06-ipc-protocol.md](06-ipc-protocol.md)。

## 6. 数据流（B超报告示例）

```
采集图片 → Buffer → 本地临时文件/内存
   ↓
表单数据 + 选中图片
   ↓
main: renderReport(params) → docx Buffer → base64
   ↓
renderer: docx-preview → html2canvas → jpeg
   ↓
先上传服务器(成功?) → 写本地 DB(isUpload=Y/N)
```

## 7. 错误处理与日志

- 统一 `Result<T>` 或抛错语义二选一（建议：主进程 handler 抛错，渲染层统一 toast）。
- 日志分级：`error/warn/info/debug`，主进程写文件（electron-log），渲染转发到主进程。
- 关键路径埋点：设备枚举、串口打开、报告生成耗时、上传结果、内存峰值。

## 8. 与现状的映射

| 现状目录/文件 | 目标位置 |
| --- | --- |
| `main/database/*` | `main/infra/database/*` |
| `main/ipc/serialport.ts` | `main/infra/hardware/serial/*` + `main/ipc/modules/bp.ts` |
| `main/ipc/b-scan.ts` | `main/ipc/modules/bscan.ts` + `main/domain/report/*` |
| `main/utils/driver/*` | `main/infra/hardware/driver/*` |
| `main/updater/*` | `main/infra/update/*` |
| `main/utils/store/*` | `main/infra/store/*` |
| `main/utils/windows/*` | `main/infra/window/*` |
| `renderer/src/apis/*` | `renderer/src/api/*` |
| `renderer/src/store/modules/*` | `renderer/src/stores/*` |
| `renderer/src/views/*` | `renderer/src/views/*`（保留） |

> 迁移以「先搭骨架、再逐模块搬运并补类型」为节奏，见 [07-refactor-plan.md](07-refactor-plan.md)。
