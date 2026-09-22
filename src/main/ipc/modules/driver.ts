import { handle } from '../registry'
import { checkDriverInstalled, installDriver, uninstallDriver } from '../../infra/hardware/driver'

/** 驱动管理 IPC */
export function registerDriverIpc(): void {
  handle('driver:status', (_event, name) => checkDriverInstalled(name))
  handle('driver:install', (_event, name) => installDriver(name))
  handle('driver:uninstall', (_event, name) => uninstallDriver(name))
}
