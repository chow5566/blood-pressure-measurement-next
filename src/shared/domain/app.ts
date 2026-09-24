/** 应用运行时配置、登录、驱动、更新相关类型 */

/** 窗口模式：登录（小窗、锁定尺寸） / 主应用（大窗、可缩放） */
export type WindowMode = 'login' | 'main'

/** 默认服务端接口地址（后端契约，不可变更） */
export const DEFAULT_BASE_API = 'http://www.chealth.cn/health-display-local/'
/** 默认静态资源地址 */
export const DEFAULT_STATIC_API = 'http://www.chealth.cn/local-data-display/'

/** 采集快捷键（key 使用 KeyboardEvent.code，如 F3 / KeyS） */
export interface PhotoHotkey {
  key: string
  ctrl: boolean
  alt: boolean
  shift: boolean
}

/** 快捷键配置：按动作名索引，便于后续扩展更多快捷键 */
export type HotkeyConfig = Record<string, PhotoHotkey>

/** B超视频滤镜配置 */
export interface VideoFilterConfig {
  /** 灰度 */
  gray: boolean
  /** 反色 */
  invert: boolean
  /** 增益（亮度） */
  brightness: number
  /** 对比度 */
  contrast: number
  /** 饱和度 */
  saturation: number
  /** 色调 */
  hue: number
  /** 降噪（模糊，px） */
  blur: number
}

/** 报告模板配置 */
export interface ReportTemplateConfig {
  title: string
}

/** B超采集偏好（持久化） */
export interface BScanPrefs {
  /** 体检类型：GW 公卫 / BS 商业 */
  type: 'GW' | 'BS'
  /** 采集后默认勾选 */
  defaultCheckPic: boolean
  /** 联网使用 */
  online: boolean
}

/** 主进程 → 渲染 的运行时配置快照 */
export interface RuntimeConfig {
  /** 服务端接口地址 */
  baseApi: string
  /** 静态资源地址（图片） */
  staticApi: string
  /** 默认接口地址（用于「恢复默认」） */
  defaultBaseApi: string
  /** 默认静态资源地址（用于「恢复默认」） */
  defaultStaticApi: string
  /** 数据目录 */
  dataDir: string
  /** 渲染模式 */
  renderMode: 'gpu' | 'software'
  /** B超采集快捷键 */
  hotkeys: HotkeyConfig
  /** B超视频滤镜 */
  videoFilter: VideoFilterConfig
  /** 报告模板配置 */
  reportTemplate: ReportTemplateConfig
  /** B超采集偏好 */
  bScanPrefs: BScanPrefs
  /** 是否已登录（token 非空）；不下发 token 明文 */
  loggedIn: boolean
  /** 当前登录用户名 */
  username: string
  /** 应用版本 */
  version: string
}

/** 更新运行时配置（部分） */
export interface RuntimeConfigPatch {
  baseApi?: string
  staticApi?: string
  renderMode?: 'gpu' | 'software'
  hotkeys?: HotkeyConfig
  videoFilter?: VideoFilterConfig
  reportTemplate?: ReportTemplateConfig
  bScanPrefs?: BScanPrefs
}

/** 登录入参 */
export interface LoginInput {
  username: string
  password: string
  /** 记住我（仅用于回填，不落密码） */
  rememberMe?: boolean
  /** 图形验证码 */
  captcha?: string
  /** 验证码对应的 uuid */
  uuid?: string
}

/** 登录结果 */
export interface LoginResult {
  ok: boolean
  message?: string
  username?: string
  user?: Record<string, unknown>
}

/** 机构授权弹窗信息（GET /bs/authOrgConfig/popups） */
export interface AuthPopupInfo {
  /** 是否需要弹窗（1 需要） */
  isPopups?: number
  /** 提示文案（含 [expireTime] 占位符） */
  warningMsg?: string
  /** 到期时间 */
  expireTime?: string
  /** 机构管理员可延期次数 */
  managerExtendCount?: number
}

/** 网络状态（底部状态栏） */
export interface NetStatus {
  /** 是否联网 */
  online: boolean
  /** WiFi 信号强度（0~100）；非 WiFi 或不可用为 null */
  wifiSignal: number | null
  /** 当前 WiFi 名称；无则 null */
  wifiSsid: string | null
}

/** 更新状态 */
export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'paused'
  | 'finalizing'
  | 'downloaded'
  | 'cancelled'
  | 'error'

/** 网络重试信息（下载中网络中断/离线时） */
export interface UpdateRetryInfo {
  /** 当前第几次尝试 */
  attempt: number
  /** 最大尝试次数 */
  maxAttempts: number
  /** 距下次重试的秒数 */
  delaySeconds: number
  /** 是否处于离线等待 */
  offline: boolean
  /** 触发原因（如“连接超时”“HTTP 502”） */
  reason?: string
}

/** 更新状态快照（主进程 → 渲染） */
export interface UpdateStatus {
  state: UpdateState
  /** 当前应用版本 */
  currentVersion?: string
  /** 目标版本号 */
  version?: string
  /** 版本发布名称（若有） */
  releaseName?: string
  /** 发布日期（ISO 字符串） */
  releaseDate?: string
  /** 更新说明（Markdown 原文） */
  releaseNotes?: string
  /** 安装包大小（字节） */
  sizeBytes?: number
  /** 已下载字节 */
  transferred?: number
  /** 需要下载的总字节（通常等于 sizeBytes） */
  total?: number
  /** 下载速度（字节/秒） */
  bytesPerSecond?: number
  /** 下载进度 0~100 */
  percent?: number
  /** 是否存在可续传的未完成下载（已下载一部分，可继续） */
  resumable?: boolean
  /** 网络重试信息（存在表示正在自动重试） */
  retry?: UpdateRetryInfo
  /** 检查/下载失败的错误信息 */
  message?: string
}
