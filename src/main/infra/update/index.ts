import electronUpdater from 'electron-updater'
import { logger } from '../logger'
import { broadcast } from '../../ipc/registry'
import type { UpdateStatus } from '../../../shared/domain/app'

/**
 * 自动更新（electron-updater + generic provider）。
 * 更新源见 electron-builder.yml 的 publish 配置与 dev-app-update.yml。
 */

const { autoUpdater } = electronUpdater

let status: UpdateStatus = { state: 'idle' }

/** 更新状态并广播给渲染进程 */
function setStatus(patch: Partial<UpdateStatus>): void {
  status = { ...status, ...patch }
  broadcast('update:status', status)
}

/** 获取当前状态 */
export function getUpdateStatus(): UpdateStatus {
  return status
}

/** 归一化更新说明（string | ReleaseNoteInfo[] | null） */
function formatReleaseNotes(notes: unknown): string {
  if (!notes) return ''
  if (typeof notes === 'string') return notes
  if (Array.isArray(notes)) {
    return notes
      .map((item) => (item as { note?: string })?.note ?? '')
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

/** 首个安装包大小（字节） */
function firstFileSize(info: unknown): number | undefined {
  const files = (info as { files?: { size?: number }[] })?.files
  return files?.[0]?.size
}

/** 初始化更新器（仅绑定事件，不自动检查） */
export function initUpdater(): void {
  try {
    autoUpdater.autoDownload = false
    autoUpdater.forceDevUpdateConfig = true
    autoUpdater.disableWebInstaller = false
    autoUpdater.logger = logger

    autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking', message: '' }))
    autoUpdater.on('update-available', (info) =>
      setStatus({
        state: 'available',
        version: info.version,
        releaseNotes: formatReleaseNotes(info.releaseNotes),
        sizeBytes: firstFileSize(info)
      })
    )
    autoUpdater.on('update-not-available', () => setStatus({ state: 'not-available' }))
    autoUpdater.on('download-progress', (progress) =>
      setStatus({ state: 'downloading', percent: Math.round(progress.percent) })
    )
    autoUpdater.on('update-downloaded', (info) =>
      setStatus({ state: 'downloaded', version: info.version })
    )
    autoUpdater.on('error', (error) => setStatus({ state: 'error', message: error.message }))
  } catch (error) {
    logger.warn('[update] init failed', error)
  }
}

/** 检查更新 */
export async function checkForUpdate(): Promise<UpdateStatus> {
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    setStatus({ state: 'error', message: (error as Error).message })
  }
  return status
}

/** 下载更新 */
export async function downloadUpdate(): Promise<UpdateStatus> {
  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    setStatus({ state: 'error', message: (error as Error).message })
  }
  return status
}

/** 退出并安装 */
export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}
