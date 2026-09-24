/**
 * 主进程 / 预加载 / 渲染进程共享的 IPC 契约。
 *
 * 约定：
 * - 通道命名 `<domain>:<action>`，全小写。
 * - `IpcContract` 描述「请求-响应」通道（ipcRenderer.invoke / ipcMain.handle）。
 * - `IpcEvents` 描述「主 → 渲染」单向推送通道（webContents.send）。
 * - 预加载层以 `INVOKE_CHANNELS` / `EVENT_CHANNELS` 做运行时白名单校验，
 *   避免渲染进程调用任意通道。
 */
import type {
  StorageInfo,
  StorageValidateResult,
  MigrateResult,
  MigrateProgress,
  LowSpaceInfo
} from './domain/storage'
import type {
  BpPort,
  BloodPressureDataEvent,
  BloodPressureRecord,
  BloodPressureRecordResult,
  BloodPressureSubmitInput,
  BloodPressureUploadResult
} from './domain/blood-pressure'
import type {
  BScanOperationResult,
  BScanImage,
  BScanRecord,
  BScanReportParams,
  BScanSaveInput,
  BScanTemplate,
  BScanUploadInput,
  OnlineBScanData
} from './domain/b-scan'
import type { OperationResult, PageQuery, PageResult } from './domain/common'
import type {
  AuthPopupInfo,
  LoginInput,
  LoginResult,
  NetStatus,
  RuntimeConfig,
  RuntimeConfigPatch,
  UpdateStatus,
  WindowMode
} from './domain/app'

/** 应用与环境信息 */
export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  v8: string
  arch: string
  /** 操作系统位数（x86=32 位 / x64=64 位） */
  osArch: 'x86' | 'x64'
  platform: string
  dataDir: string
  /** 数据库文件路径 */
  dbFile: string
  /** 数据库是否已连接 */
  dbReady: boolean
}

/**
 * 请求-响应契约：key 为通道名，value 为处理函数签名。
 * 主进程按该契约注册 handler，渲染进程按该契约调用。
 */
export interface IpcContract {
  /** 连通性测试 */
  'app:ping': (message: string) => string
  /** 应用与环境信息 */
  'app:info': () => AppInfo
  /** 网络状态（联网 / WiFi 信号） */
  'app:net-status': () => NetStatus
  /** 用系统浏览器打开外部链接 */
  'app:open-external': (url: string) => void
  /** 渲染进程日志汇聚到主进程文件日志 */
  'log:renderer': (level: 'info' | 'warn' | 'error', message: string) => void

  /** 当前本地存储信息 */
  'storage:info': () => StorageInfo
  /** 打开系统目录选择框，返回所选目录（取消返回 null） */
  'storage:choose-dir': () => string | null
  /** 校验目标数据目录是否可用于迁移 */
  'storage:validate': (target: string) => StorageValidateResult
  /** 执行迁移（成功后应用会自动重启） */
  'storage:migrate': (target: string) => MigrateResult
  /** 在文件管理器中打开数据目录 */
  'storage:open-dir': (target?: string) => void

  /** 列出血压计串口设备 */
  'bp:list-ports': () => BpPort[]
  /** 打开血压计串口并开始接收数据 */
  'bp:open': (path: string) => OperationResult
  /** 向血压计发送指令（启动/停止测量） */
  'bp:send': (path: string, command: number[]) => OperationResult
  /** 关闭全部血压计串口 */
  'bp:close-all': () => void
  /** 一次测量结果落库并尝试上传 */
  'bp:record': (input: BloodPressureSubmitInput) => BloodPressureRecordResult
  /** 分页查询血压历史 */
  'bp:page': (query: PageQuery) => PageResult<BloodPressureRecord>
  /** 删除血压记录 */
  'bp:delete': (ids: number[]) => void
  /** 批量补传血压记录 */
  'bp:upload': (ids: number[]) => BloodPressureUploadResult

  /** 生成 B超报告（返回 docx dataURL） */
  'bscan:render-report': (params: BScanReportParams) => string
  /** 保存 B超记录（含图片落盘） */
  'bscan:save': (input: BScanSaveInput) => BScanOperationResult
  /** 清空某条码的图片（分批保存前调用） */
  'bscan:clear-images': (barcode: string) => BScanOperationResult
  /** 分批保存某条码的图片（追加/更新，不删除其它） */
  'bscan:save-images': (barcode: string, images: BScanImage[]) => BScanOperationResult
  /** 查询单条 B超记录（含图片 base64） */
  'bscan:get': (barcode: string) => BScanRecord | null
  /** 分页查询 B超记录 */
  'bscan:page-list': (query: PageQuery) => PageResult<BScanRecord>
  /** 上传 B超记录 */
  'bscan:upload': (input: BScanUploadInput) => BScanOperationResult
  /** 删除 B超记录（含图片） */
  'bscan:delete': (barcodes: string[]) => BScanOperationResult
  /** 修改 B超记录条码号（含图片目录迁移） */
  'bscan:change-barcode': (oldBarcode: string, newBarcode: string) => BScanOperationResult
  /** 查询 B超报告模板 */
  'bscan:templates': (dataType?: string, keyword?: string) => BScanTemplate[]
  /** 新增/修改 B超模板或类型 */
  'bscan:template-save': (template: BScanTemplate) => BScanOperationResult
  /** 删除 B超模板或类型 */
  'bscan:template-delete': (id: string) => BScanOperationResult
  /** 从服务器获取公共模板并覆盖本地 */
  'bscan:template-sync': () => BScanOperationResult
  /** 在线查询 B超数据（需登录） */
  'bscan:online-lookup': (barcode: string, type?: string) => OnlineBScanData | null

  /** 读取运行时配置 */
  'config:get': () => RuntimeConfig
  /** 更新运行时配置（部分） */
  'config:update': (patch: RuntimeConfigPatch) => RuntimeConfig

  /** 登录 */
  'auth:login': (input: LoginInput) => LoginResult
  /** 获取图形验证码（返回 dataURL，避免渲染层跨域/CSP 限制） */
  'auth:captcha': (uuid: string) => string
  /** 机构授权到期弹窗信息（无则返回 null） */
  'auth:auth-popup': (orgCode?: string) => AuthPopupInfo | null
  /** 退出登录 */
  'auth:logout': () => void

  /** 检查更新 */
  'update:check': () => UpdateStatus
  /** 下载更新（若存在未完成下载则续传） */
  'update:download': () => UpdateStatus
  /** 暂停下载（保留已下载进度，可续传） */
  'update:pause': () => UpdateStatus
  /** 取消更新并清除已下载进度 */
  'update:cancel': () => UpdateStatus
  /** 退出并安装 */
  'update:install': () => void
  /** 当前更新状态 */
  'update:status': () => UpdateStatus

  /** 最小化窗口 */
  'window:minimize': () => void
  /** 切换最大化，返回切换后是否最大化 */
  'window:toggle-maximize': () => boolean
  /** 关闭窗口 */
  'window:close': () => void
  /** 当前是否最大化 */
  'window:is-maximized': () => boolean
  /** 切换窗口模式（登录小窗 / 主应用大窗） */
  'window:set-mode': (mode: WindowMode) => void
}

/** 主 → 渲染 的推送事件契约 */
export interface IpcEvents {
  /** 迁移进度 */
  'storage:migrate-progress': (progress: MigrateProgress) => void
  /** 低空间预警 */
  'storage:low-space': (info: LowSpaceInfo) => void
  /** 血压计数据帧 */
  'bp:data': (payload: BloodPressureDataEvent) => void
  /** 血压计设备列表变化 */
  'bp:devices': (ports: BpPort[]) => void
  /** 自动更新状态变化 */
  'update:status': (status: UpdateStatus) => void
  /** 窗口最大化状态变化 */
  'window:maximized': (isMaximized: boolean) => void
}

/** 所有请求通道名（运行时白名单） */
export const INVOKE_CHANNELS = [
  'app:ping',
  'app:info',
  'app:net-status',
  'app:open-external',
  'log:renderer',
  'storage:info',
  'storage:choose-dir',
  'storage:validate',
  'storage:migrate',
  'storage:open-dir',
  'bp:list-ports',
  'bp:open',
  'bp:send',
  'bp:close-all',
  'bp:record',
  'bp:page',
  'bp:delete',
  'bp:upload',
  'bscan:render-report',
  'bscan:save',
  'bscan:clear-images',
  'bscan:save-images',
  'bscan:get',
  'bscan:page-list',
  'bscan:upload',
  'bscan:delete',
  'bscan:change-barcode',
  'bscan:templates',
  'bscan:template-save',
  'bscan:template-delete',
  'bscan:template-sync',
  'bscan:online-lookup',
  'config:get',
  'config:update',
  'auth:login',
  'auth:captcha',
  'auth:auth-popup',
  'auth:logout',
  'update:check',
  'update:download',
  'update:pause',
  'update:cancel',
  'update:install',
  'update:status',
  'window:minimize',
  'window:toggle-maximize',
  'window:close',
  'window:is-maximized',
  'window:set-mode'
] as const satisfies readonly (keyof IpcContract)[]

/** 所有事件通道名（运行时白名单） */
export const EVENT_CHANNELS = [
  'storage:migrate-progress',
  'storage:low-space',
  'bp:data',
  'bp:devices',
  'update:status',
  'window:maximized'
] as const satisfies readonly (keyof IpcEvents)[]

export type InvokeChannel = (typeof INVOKE_CHANNELS)[number]
export type EventChannel = (typeof EVENT_CHANNELS)[number]

/** 类型守卫：判断字符串是否为合法的请求通道 */
export function isInvokeChannel(channel: string): channel is InvokeChannel {
  return (INVOKE_CHANNELS as readonly string[]).includes(channel)
}

/** 类型守卫：判断字符串是否为合法的事件通道 */
export function isEventChannel(channel: string): channel is EventChannel {
  return (EVENT_CHANNELS as readonly string[]).includes(channel)
}
