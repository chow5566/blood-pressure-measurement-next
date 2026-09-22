import { logger } from '../infra/logger'
import { registerAppIpc } from './modules/app'
import { registerStorageIpc } from './modules/storage'
import { registerBloodPressureIpc } from './modules/blood-pressure'
import { registerBScanIpc } from './modules/b-scan'
import { registerConfigIpc } from './modules/config'
import { registerAuthIpc } from './modules/auth'
import { registerDriverIpc } from './modules/driver'
import { registerUpdateIpc } from './modules/update'
import { registerWindowIpc } from './modules/window'

/**
 * 注册全部 IPC 模块。
 * 新增模块时在此处挂载。
 */
export function registerIpc(): void {
  registerAppIpc()
  registerConfigIpc()
  registerStorageIpc()
  registerBloodPressureIpc()
  registerBScanIpc()
  registerAuthIpc()
  registerDriverIpc()
  registerUpdateIpc()
  registerWindowIpc()
  logger.info('[ipc] handlers registered')
}
