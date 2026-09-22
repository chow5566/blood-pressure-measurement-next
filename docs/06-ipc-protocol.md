# 06 · IPC 协议（现状 → 目标）

## 1. 现状通道清单

> 来源：`src/main/ipc/*`、`src/main/updater/index.ts`、`src/main/utils/*`
> 通道名大小写与拼写**保持现状**以兼容，重构时再统一规范。

### 1.1 窗口

| 通道 | 类型 | 方向 | 说明 |
| --- | --- | --- | --- |
| `window:create` | invoke | R→M | 创建新窗口 |
| `window:*`（status） | on/send | 双向 | 最小化/关闭/最大化等，详见 `ipc/window-status.ts` |

### 1.2 本地存储（electron-store）

| 通道 | 类型 | 说明 |
| --- | --- | --- |
| `store:set` | on | 写入 |
| `store:get` | handle | 读取（异步） |
| `store:get:sync` | on + returnValue | 同步读取 |
| `store:getAll` | handle | 读取全部 |
| `store:reset` | on | 重置指定 key |
| `store:delete` | on | 删除 key |
| `store:clear` | on | 清空 |
| `pinia:stateChanged` | on + broadcast | 多窗口 Pinia 状态同步 |

### 1.3 血压计串口

| 通道 | 类型 | 说明 |
| --- | --- | --- |
| `port:usb-change` | on + send | 订阅 USB 插拔（主→渲染 `'attach'`/`'detach'`） |
| `port:get-bp-list` | handle | 返回血压计串口列表（过滤 `1A86:7523`） |
| `port:init-bp-port` | handle | 打开串口并订阅数据 |
| `port:send-directives` | handle | 发送指令字节数组 |
| `port:close-all-port` | handle | 关闭所有串口 |
| `port:bp-data:<pnpId>` | send | 主→渲染推送串口数据 |

### 1.4 B超

| 通道 | 类型 | 说明 |
| --- | --- | --- |
| `bScan:preview:report` | handle | 入参 `BScanReportParams`，返回 docx dataURL |
| `bScan:installDriver` | handle | 安装驱动 |
| `bScan:uninstallDriver` | handle | 卸载驱动 |
| `bScan:checkDriverInstalled` | handle | 检查驱动 |

### 1.5 更新

| 通道 | 类型 | 说明 |
| --- | --- | --- |
| `app:check-update` | handle | 检查更新 |
| `app:update-app` | handle | 下载更新 |
| `update-available` / `update-not-available` | send | 主→渲染 |
| `download-progress` | send | 主→渲染 |
| `update-downloaded` / `update-error` | send | 主→渲染 |

### 1.6 服务桥（decorators）

主进程 `decorators/services/bridge.ts` 通过装饰器动态注册 `service:<ServiceName>:<method>`
通道（`ipcMain.on` 或 `ipcMain.handle`）。业务实际使用：

| 通道 | 类型 | 说明 |
| --- | --- | --- |
| `service:bloodPressure:add` | handle | 新增血压记录 |
| `service:bloodPressure:update` | handle | 更新血压记录（上传状态） |

> 重构建议：改为显式的 `bp:add` / `bp:update`，或在桥层保留命名但补齐类型。

### 1.7 存储目录与迁移（新增，目标）

| 通道 | 类型 | 说明 |
| --- | --- | --- |
| `storage:get-info` | handle | 返回当前数据目录、占用、剩余空间 |
| `storage:set-dir` | handle | 设置数据目录（触发迁移，返回结果） |
| `storage:migrate` | handle | 执行迁移，流式推送 `storage:migrate-progress` |
| `storage:open-dir` | handle | 在文件管理器中打开数据目录 |
| `storage:migrate-progress` | send | 主→渲染迁移进度 |
| `storage:low-space` | send | 主→渲染低空间预警 |

## 2. 目标协议规范

### 2.1 命名

- 统一小写蛇形或冒号分级：`<domain>:<action>`，全小写，如 `bp:list-ports`。
- 事件推送统一后缀语义：`<domain>:<event>`，如 `bp:data`、`usb:change`。
- 通道常量集中定义于 `src/main/shared/ipc.ts`，主/预加载/渲染共享。

### 2.2 类型化示例

```ts
// src/main/shared/ipc.ts
export interface IpcApi {
  'bp:list-ports': () => Promise<PortDto[]>
  'bp:open': (info: PortDto) => Promise<void>
  'bp:send': (info: PortDto, cmd: number[]) => Promise<void>
  'bp:close-all': () => Promise<void>

  'bscan:render-report': (p: ReportParams) => Promise<string> // docx dataURL
  'driver:check': (name: DriverName) => Promise<boolean>
  'driver:install': (name: DriverName) => Promise<void>
  'driver:uninstall': (name: DriverName) => Promise<void>

  'update:check': () => Promise<UpdateStatus>
  'update:download': () => Promise<void>

  'storage:get-info': () => Promise<StorageInfo>
  'storage:migrate': (to: string) => Promise<MigrateResult>
  'storage:open-dir': () => Promise<void>
}

export interface StorageInfo {
  dataDir: string
  totalBytes: number
  freeBytes: number
  isLocalDisk: boolean
}

export interface MigrateResult {
  ok: boolean
  from: string
  to: string
  backupDir?: string
  message?: string
}

export interface IpcEvents {
  'bp:data': (pnpId: string, data: Uint8Array) => void
  'usb:change': (type: 'attach' | 'detach') => void
  'update:progress': (p: { percent: number }) => void
  'update:downloaded': () => void
  'update:error': (message: string) => void
}
```

### 2.3 preload 暴露

```ts
// window.api
contextBridge.exposeInMainWorld('api', {
  invoke: <K extends keyof IpcApi>(channel: K, ...args: Parameters<IpcApi[K]>) =>
    ipcRenderer.invoke(channel, ...args),
  on: <K extends keyof IpcEvents>(event: K, cb: IpcEvents[K]) => {
    const listener = (_e, ...args) => cb(...args)
    ipcRenderer.on(event, listener)
    return () => ipcRenderer.removeListener(event, listener)
  }
})
```

> 不再像现状那样让渲染层直接 `window.electron.ipcRenderer`，避免暴露原始 `ipcRenderer`。

## 3. 兼容策略

- 阶段一（搬运）：**保留旧通道名**，确保渲染层可无改动接入。
- 阶段二（收敛）：新增类型化 API，逐步替换调用点。
- 阶段三（清理）：删除旧通道，更新文档。

## 4. 修复项

| 编号 | 问题 | 目标 |
| --- | --- | --- |
| I1 | `port:send-directives` 超时逻辑缺陷 | 已修复：`bp:send` 以写入回调成功/失败为准（不再有假超时分支） |
| I2 | `port:init-bp-port` 每次都 `removeAllListeners` 且全局单例，多窗口会串 | 已解决：单窗口 + 按 `path` 过滤事件；主进程统一管理串口 |
| I3 | `store:get:sync` 中未 return，`event.returnValue` 可能被覆盖 | 新实现不提供同步 store 通道 |
| I4 | `pinia:stateChanged` 广播无节流 | 单窗口架构下不再需要跨窗口同步 |
| I5 | 驱动安装在主进程同步 `exec`，无进度/超时 | 待 M5 处理 |

## 5. 已实现通道（M2 / M3）

> 以 `src/shared/ipc.ts` 为准；此处为速查。

**请求-响应**

| 通道 | 入参 | 返回 |
| --- | --- | --- |
| `app:ping` | `message` | `string` |
| `app:info` | — | `AppInfo` |
| `storage:info` | — | `StorageInfo` |
| `storage:choose-dir` | — | `string \| null` |
| `storage:validate` | `target` | `StorageValidateResult` |
| `storage:migrate` | `target` | `MigrateResult` |
| `storage:open-dir` | `target?` | `void` |
| `bp:list-ports` | — | `BpPort[]` |
| `bp:open` | `path` | `OperationResult` |
| `bp:send` | `path, command: number[]` | `OperationResult` |
| `bp:close-all` | — | `void` |
| `bp:record` | `BloodPressureSubmitInput` | `BloodPressureRecordResult` |
| `bscan:render-report` | `BScanReportParams` | `string`（docx dataURL） |
| `bscan:save` | `BScanSaveInput` | `BScanOperationResult` |
| `bscan:get` | `barcode` | `BScanRecord \| null` |
| `bscan:page-list` | `PageQuery` | `PageResult<BScanRecord>` |
| `bscan:upload` | `BScanUploadInput` | `BScanOperationResult` |
| `bscan:delete` | `barcodes` | `BScanOperationResult` |
| `bscan:templates` | `dataType?, keyword?` | `BScanTemplate[]` |
| `bscan:online-lookup` | `barcode, type?` | `OnlineBScanData \| null` |
| `config:get` | — | `RuntimeConfig` |
| `config:update` | `RuntimeConfigPatch` | `RuntimeConfig` |
| `auth:login` | `LoginInput` | `LoginResult` |
| `auth:logout` | — | `void` |
| `driver:status` | `name` | `DriverStatus` |
| `driver:install` | `name` | `DriverStatus` |
| `driver:uninstall` | `name` | `DriverStatus` |
| `update:check` | — | `UpdateStatus` |
| `update:download` | — | `UpdateStatus` |
| `update:install` | — | `void` |
| `update:status` | — | `UpdateStatus` |

**主 → 渲染 事件**

| 通道 | 负载 |
| --- | --- |
| `storage:migrate-progress` | `MigrateProgress` |
| `storage:low-space` | `LowSpaceInfo` |
| `bp:data` | `{ path, frame: BloodPressureFrame }` |
| `bp:devices` | `BpPort[]` |
| `update:status` | `UpdateStatus` |
