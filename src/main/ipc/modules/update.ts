import { handle } from '../registry'
import {
  checkForUpdate,
  startDownload,
  pauseDownload,
  cancelDownload,
  getUpdateStatus,
  quitAndInstall
} from '../../infra/update'

/** 自动更新 IPC */
export function registerUpdateIpc(): void {
  handle('update:check', () => checkForUpdate())
  handle('update:download', () => startDownload())
  handle('update:pause', () => pauseDownload())
  handle('update:cancel', () => cancelDownload())
  handle('update:install', () => quitAndInstall())
  handle('update:status', () => getUpdateStatus())
}
