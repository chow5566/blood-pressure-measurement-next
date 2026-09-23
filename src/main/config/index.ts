import { app } from 'electron'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Store from 'electron-store'
import {
  DEFAULT_BASE_API,
  DEFAULT_STATIC_API,
  type BScanPrefs,
  type HotkeyConfig,
  type ReportTemplateConfig,
  type VideoFilterConfig
} from '../../shared/domain/app'
import { DEFAULT_HOTKEYS } from '../../shared/domain/hotkeys'

/**
 * 应用配置（存于 %APPDATA%\<appName>\config.json）。
 *
 * `dataDir` 是本地业务数据（SQLite / 图片 / 报告）的**唯一根目录**，可迁移。
 * 其余数据目录布局见 infra/storage/storage-paths.ts。
 */
export interface AppConfig {
  /** 数据根目录 */
  dataDir: string
  /** 渲染模式：gpu 默认；软件渲染用于 Win7 GPU 兼容排障 */
  renderMode: 'gpu' | 'software'
  /** 服务端接口地址 */
  baseApi: string
  /** 静态资源地址（图片） */
  staticApi: string
  /** B超采集快捷键 */
  hotkeys: HotkeyConfig
  /** B超视频滤镜 */
  videoFilter: VideoFilterConfig
  /** 报告模板配置 */
  reportTemplate: ReportTemplateConfig
  /** B超采集偏好 */
  bScanPrefs: BScanPrefs
  /** 登录令牌（由登录流程写入） */
  token: string
  /** 当前登录用户名 */
  username: string
}

/** 默认视频滤镜 */
const DEFAULT_VIDEO_FILTER: VideoFilterConfig = {
  gray: false,
  invert: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  blur: 0
}

/** 默认报告模板 */
const DEFAULT_REPORT_TEMPLATE: ReportTemplateConfig = { title: '社区卫生服务中心' }

/** 默认 B超采集偏好 */
const DEFAULT_BSCAN_PREFS: BScanPrefs = { type: 'GW', defaultCheckPic: true, online: true }

/** 默认服务端接口地址（供「恢复默认」使用） */
export function getDefaultBaseApi(): string {
  return DEFAULT_BASE_API
}

/** 默认静态资源地址（供「恢复默认」使用） */
export function getDefaultStaticApi(): string {
  return DEFAULT_STATIC_API
}

/** 数据目录下需要预先创建的子目录 */
const REQUIRED_SUB_DIRS = ['database', 'images', 'reports', 'temp'] as const

/** 旧版本默认数据目录名（<安装目录>/../blood-pressure-measurement-data） */
const LEGACY_DIR_NAME = 'blood-pressure-measurement-data'

/** 安装器写入数据目录的注册表位置 */
const DATADIR_REG_KEY = 'HKLM\\Software\\skzxsci\\blood-pressure-measurement'

let store: Store<AppConfig> | null = null

/** 获取（惰性创建）配置存储 */
function getStore(): Store<AppConfig> {
  if (store) return store
  store = new Store<AppConfig>({
    name: 'config',
    defaults: {
      dataDir: resolveDefaultDataDir(),
      renderMode: 'gpu',
      baseApi: DEFAULT_BASE_API,
      staticApi: DEFAULT_STATIC_API,
      hotkeys: DEFAULT_HOTKEYS,
      videoFilter: DEFAULT_VIDEO_FILTER,
      reportTemplate: DEFAULT_REPORT_TEMPLATE,
      bScanPrefs: DEFAULT_BSCAN_PREFS,
      token: '',
      username: ''
    }
  })
  return store
}

/**
 * 默认数据目录：优先 `%ProgramData%\<appName>\data`，回退用户数据目录。
 * 说明：不使用安装目录（Program Files 不可写且不合规范）。
 */
function resolveDefaultDataDir(): string {
  const programData = process.env.ProgramData || process.env.ALLUSERSPROFILE
  if (programData) {
    return join(programData, app.getName(), 'data')
  }
  return join(app.getPath('userData'), 'data')
}

/** 旧版本数据目录（用于兼容探测） */
export function getLegacyDataDirs(): string[] {
  const dirs: string[] = []
  try {
    // 打包后 app.getAppPath() = <安装目录>/resources/app.asar
    // 旧实现将数据放在 <appPath>/../../../<appName>-data
    dirs.push(join(app.getAppPath(), '..', '..', '..', LEGACY_DIR_NAME))
  } catch {
    // app 尚未 ready 等情况，忽略
  }
  return Array.from(new Set(dirs))
}

/** 读取安装器写入注册表的数据目录（首次启动采纳） */
export function getInstallerDataDir(): string | null {
  if (process.platform !== 'win32') return null
  try {
    const output = execFileSync('reg', ['query', DATADIR_REG_KEY, '/v', 'DataDir'], {
      windowsHide: true,
      timeout: 10000,
      encoding: 'utf-8'
    })
    const match = /DataDir\s+REG_SZ\s+(.+)/.exec(output)
    const dir = match?.[1]?.trim()
    return dir || null
  } catch {
    return null
  }
}

/** 获取当前数据目录 */
export function getDataDir(): string {
  return getStore().get('dataDir')
}

/** 设置数据目录（仅改配置指针，实际迁移见 migration-service） */
export function setDataDir(dir: string): void {
  getStore().set('dataDir', dir)
}

/** 获取渲染模式 */
export function getRenderMode(): 'gpu' | 'software' {
  return getStore().get('renderMode')
}

/** 设置渲染模式 */
export function setRenderMode(mode: 'gpu' | 'software'): void {
  getStore().set('renderMode', mode)
}

/** 服务端接口地址 */
export function getBaseApi(): string {
  return getStore().get('baseApi')
}

/** 设置服务端接口地址 */
export function setBaseApi(url: string): void {
  getStore().set('baseApi', url)
}

/** 登录令牌 */
export function getToken(): string {
  return getStore().get('token')
}

/** 设置登录令牌（登录成功后写入） */
export function setToken(token: string): void {
  getStore().set('token', token)
}

/** 静态资源地址（图片） */
export function getStaticApi(): string {
  return getStore().get('staticApi')
}

/** 设置静态资源地址 */
export function setStaticApi(url: string): void {
  getStore().set('staticApi', url)
}

/** B超采集快捷键 */
export function getHotkeys(): HotkeyConfig {
  return getStore().get('hotkeys')
}

/** 设置 B超采集快捷键 */
export function setHotkeys(hotkeys: HotkeyConfig): void {
  getStore().set('hotkeys', hotkeys)
}

/** B超视频滤镜 */
export function getVideoFilter(): VideoFilterConfig {
  return getStore().get('videoFilter')
}

/** 设置 B超视频滤镜 */
export function setVideoFilter(videoFilter: VideoFilterConfig): void {
  getStore().set('videoFilter', videoFilter)
}

/** 报告模板配置 */
export function getReportTemplate(): ReportTemplateConfig {
  return getStore().get('reportTemplate')
}

/** 设置报告模板配置 */
export function setReportTemplate(reportTemplate: ReportTemplateConfig): void {
  getStore().set('reportTemplate', reportTemplate)
}

/** B超采集偏好 */
export function getBScanPrefs(): BScanPrefs {
  return getStore().get('bScanPrefs')
}

/** 设置 B超采集偏好 */
export function setBScanPrefs(prefs: BScanPrefs): void {
  getStore().set('bScanPrefs', prefs)
}

/** 当前登录用户名 */
export function getUsername(): string {
  return getStore().get('username')
}

/** 设置登录用户名 */
export function setUsername(name: string): void {
  getStore().set('username', name)
}

/** 确保数据目录及其子目录存在 */
export function ensureDataDir(dir: string = getDataDir()): string {
  for (const sub of REQUIRED_SUB_DIRS) {
    mkdirSync(join(dir, sub), { recursive: true })
  }
  return dir
}

/**
 * 解析最终使用的数据目录：
 * 1. 配置中的目录若已含 database 子目录 → 直接使用；
 * 2. 安装器写入注册表的目录（首次启动采纳）；
 * 3. 旧版本默认目录（兼容升级）；
 * 4. 都不存在 → 使用默认目录并创建布局。
 */
export function resolveDataDir(): string {
  const configured = getDataDir()
  if (existsSync(join(configured, 'database'))) {
    return configured
  }

  // 安装器选择的数据目录
  const installerDir = getInstallerDataDir()
  if (installerDir) {
    try {
      if (existsSync(join(installerDir, 'database'))) {
        setDataDir(installerDir)
        return installerDir
      }
      // 目录尚未初始化：采纳并创建布局
      ensureDataDir(installerDir)
      setDataDir(installerDir)
      return installerDir
    } catch {
      // 忽略，继续后续探测
    }
  }

  for (const legacy of getLegacyDataDirs()) {
    if (legacy && existsSync(join(legacy, 'database'))) {
      setDataDir(legacy)
      return legacy
    }
  }

  ensureDataDir(configured)
  return configured
}
