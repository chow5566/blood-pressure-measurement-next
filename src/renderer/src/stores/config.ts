import { defineStore } from 'pinia'
import { configApi } from '@r/api/config'
import { DEFAULT_HOTKEYS } from '@shared/domain/hotkeys'
import type {
  BScanPrefs,
  HotkeyConfig,
  ReportTemplateConfig,
  RuntimeConfig,
  RuntimeConfigPatch,
  VideoFilterConfig
} from '@shared/domain/app'

const DEFAULT_VIDEO_FILTER: VideoFilterConfig = {
  gray: false,
  invert: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  blur: 0
}

const DEFAULT_REPORT_TEMPLATE: ReportTemplateConfig = { title: '社区卫生服务中心' }

const DEFAULT_BSCAN_PREFS: BScanPrefs = { type: 'GW', defaultCheckPic: true, online: true }

/**
 * 运行时配置（与主进程 electron-store 同步）。
 * 登录态与用户名也在此维护，便于导航门控与页面展示。
 */
export const useConfigStore = defineStore('config', {
  state: () => ({
    loaded: false,
    baseApi: '',
    staticApi: '',
    defaultBaseApi: '',
    defaultStaticApi: '',
    dataDir: '',
    renderMode: 'gpu' as 'gpu' | 'software',
    hotkeys: { ...DEFAULT_HOTKEYS } as HotkeyConfig,
    videoFilter: { ...DEFAULT_VIDEO_FILTER } as VideoFilterConfig,
    reportTemplate: { ...DEFAULT_REPORT_TEMPLATE } as ReportTemplateConfig,
    bScanPrefs: { ...DEFAULT_BSCAN_PREFS } as BScanPrefs,
    loggedIn: false,
    username: '',
    version: ''
  }),
  actions: {
    apply(config: RuntimeConfig): void {
      this.baseApi = config.baseApi
      this.staticApi = config.staticApi
      this.defaultBaseApi = config.defaultBaseApi
      this.defaultStaticApi = config.defaultStaticApi
      this.dataDir = config.dataDir
      this.renderMode = config.renderMode
      this.hotkeys = { ...DEFAULT_HOTKEYS, ...(config.hotkeys ?? {}) }
      this.videoFilter = { ...DEFAULT_VIDEO_FILTER, ...(config.videoFilter ?? {}) }
      this.reportTemplate = config.reportTemplate ?? { ...DEFAULT_REPORT_TEMPLATE }
      this.bScanPrefs = config.bScanPrefs ?? { ...DEFAULT_BSCAN_PREFS }
      this.loggedIn = config.loggedIn
      this.username = config.username
      this.version = config.version
      this.loaded = true
    },
    async load(): Promise<RuntimeConfig> {
      const config = await configApi.get()
      this.apply(config)
      return config
    },
    async update(patch: RuntimeConfigPatch): Promise<RuntimeConfig> {
      const config = await configApi.update(patch)
      this.apply(config)
      return config
    }
  }
})
