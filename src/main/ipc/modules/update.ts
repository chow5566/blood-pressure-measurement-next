import { handle } from '../registry'
import { checkForUpdate, downloadUpdate, getUpdateStatus, quitAndInstall } from '../../infra/update'

/** 自动更新 IPC */
export function registerUpdateIpc(): void {
  handle('update:check', () => checkForUpdate())
  handle('update:download', () => downloadUpdate())
  handle('update:install', () => quitAndInstall())
  handle('update:status', () => getUpdateStatus())
}
