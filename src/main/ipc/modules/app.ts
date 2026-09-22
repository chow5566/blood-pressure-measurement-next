import { app, shell } from 'electron'
import { handle } from '../registry'
import { getDataDir } from '../../config'
import { getDatabaseFile, isDatabaseOpen } from '../../infra/database'
import { logger } from '../../infra/logger'
import type { AppInfo } from '../../../shared/ipc'

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
      platform: process.platform,
      dataDir: getDataDir(),
      dbFile: getDatabaseFile() ?? '',
      dbReady: isDatabaseOpen()
    }
  })
}
