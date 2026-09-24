import { app } from 'electron'
import { handle } from '../registry'
import {
  getBaseApi,
  getBScanPrefs,
  getBpAutoUpload,
  getDataDir,
  getDefaultBaseApi,
  getDefaultStaticApi,
  getHotkeys,
  getRenderMode,
  getReportTemplate,
  getStaticApi,
  getToken,
  getUsername,
  getVideoFilter,
  setBaseApi,
  setBScanPrefs,
  setBpAutoUpload,
  setHotkeys,
  setRenderMode,
  setReportTemplate,
  setStaticApi,
  setVideoFilter
} from '../../config'
import type { RuntimeConfig, RuntimeConfigPatch } from '../../../shared/domain/app'

/** 生成配置快照（不下发 token 明文） */
function snapshot(): RuntimeConfig {
  return {
    baseApi: getBaseApi(),
    staticApi: getStaticApi(),
    defaultBaseApi: getDefaultBaseApi(),
    defaultStaticApi: getDefaultStaticApi(),
    dataDir: getDataDir(),
    renderMode: getRenderMode(),
    hotkeys: getHotkeys(),
    videoFilter: getVideoFilter(),
    reportTemplate: getReportTemplate(),
    bScanPrefs: getBScanPrefs(),
    bpAutoUpload: getBpAutoUpload(),
    loggedIn: !!getToken(),
    username: getUsername(),
    version: app.getVersion()
  }
}

/** 配置 IPC：读取/更新运行时配置 */
export function registerConfigIpc(): void {
  handle('config:get', () => snapshot())

  handle('config:update', (_event, patch: RuntimeConfigPatch) => {
    if (patch.baseApi !== undefined) setBaseApi(patch.baseApi)
    if (patch.staticApi !== undefined) setStaticApi(patch.staticApi)
    if (patch.renderMode !== undefined) setRenderMode(patch.renderMode)
    if (patch.hotkeys !== undefined) setHotkeys(patch.hotkeys)
    if (patch.videoFilter !== undefined) setVideoFilter(patch.videoFilter)
    if (patch.reportTemplate !== undefined) setReportTemplate(patch.reportTemplate)
    if (patch.bScanPrefs !== undefined) setBScanPrefs(patch.bScanPrefs)
    if (patch.bpAutoUpload !== undefined) setBpAutoUpload(patch.bpAutoUpload)
    return snapshot()
  })
}
