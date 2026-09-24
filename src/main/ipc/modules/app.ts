import { app, shell } from 'electron'
import { handle } from '../registry'
import { getDataDir } from '../../config'
import { getDatabaseFile, isDatabaseOpen } from '../../infra/database'
import { isOnline, readWifi } from '../../infra/network'
import { logger } from '../../infra/logger'
import type { AppInfo } from '../../../shared/ipc'
import type { NetStatus } from '../../../shared/domain/app'

/** 操作系统位数（WOW64 下也取真实 OS 位数） */
function detectOsArch(): 'x86' | 'x64' {
  if (process.platform !== 'win32') {
    return process.arch === 'x64' || process.arch === 'arm64' ? 'x64' : 'x86'
  }
  const pa = process.env.PROCESSOR_ARCHITECTURE || ''
  const paW = process.env.PROCESSOR_ARCHITEW6432 || ''
  return pa.includes('64') || paW.includes('64') ? 'x64' : 'x86'
}

/**
 * 应用级 IPC：连通性测试与环境信息。
 */
export function registerAppIpc(): void {
  handle('app:ping', (_event, message) => `pong:${message}`)

  handle('app:open-external', (_event, url) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url)
    } else {
      logger.warn(`[app] blocked open-external: ${url}`)
    }
  })

  handle('log:renderer', (_event, level, message) => {
    const text = `[renderer] ${message}`
    if (level === 'error') logger.error(text)
    else if (level === 'warn') logger.warn(text)
    else logger.info(text)
  })

  handle('app:info', (): AppInfo => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      v8: process.versions.v8,
      arch: process.arch,
      osArch: detectOsArch(),
      platform: process.platform,
      dataDir: getDataDir(),
      dbFile: getDatabaseFile() ?? '',
      dbReady: isDatabaseOpen()
    }
  })

  handle('app:net-status', async (): Promise<NetStatus> => {
    const wifi = await readWifi()
    const online = isOnline()
    const type: NetStatus['type'] = wifi.connected ? 'wifi' : online ? 'wired' : 'none'
    return { online, type, wifiSignal: wifi.connected ? wifi.signal : null, wifiSsid: wifi.ssid }
  })
}
