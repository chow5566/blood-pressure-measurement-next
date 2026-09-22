import { app } from 'electron'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import electronUpdater from 'electron-updater'
import { logger } from '../logger'
import { broadcast } from '../../ipc/registry'
import { ResumableDownloader } from './downloader'
import type { UpdateStatus } from '../../../shared/domain/app'

/**
 * 自动更新（electron-updater + GitHub Releases）。
 *
 * 更新源与 channel（按 arch 区分：win-x64 / win-ia32）由 electron-builder.yml 的 publish 配置
 * 在打包时写入 `resources/app-update.yml`，运行时无需再手动设置。
 *
 * 下载使用自建的可断点续传下载器：先落到 electron-updater 的更新缓存目录，校验 sha512 后
 * 再交给 electron-updater（`downloadUpdate`）复用缓存并触发「下载完成」。
 */

const { autoUpdater } = electronUpdater

interface UpdateFileShape {
  url: string
  sha512?: string
  size?: number
}

interface UpdateInfoShape {
  version: string
  files?: UpdateFileShape[]
  releaseName?: string | null
  releaseDate?: string
  releaseNotes?: string | { note?: string }[] | null
}

let status: UpdateStatus = { state: 'idle' }
let lastUpdateInfo: UpdateInfoShape | null = null
let downloader: ResumableDownloader | null = null

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
      .join('\n\n')
  }
  return ''
}

/** 首个安装包大小（字节） */
function firstFileSize(info: unknown): number | undefined {
  const files = (info as { files?: { size?: number }[] })?.files
  return files?.[0]?.size
}

let cachedConfig: Record<string, string> | null = null

/** 读取 app-update.yml（仅解析简单键值，避免额外依赖） */
function readAppUpdateConfig(): Record<string, string> | null {
  if (cachedConfig) return cachedConfig
  try {
    const file = app.isPackaged
      ? path.join(process.resourcesPath, 'app-update.yml')
      : path.join(app.getAppPath(), 'dev-app-update.yml')
    if (!existsSync(file)) return null
    const text = readFileSync(file, 'utf-8')
    const config: Record<string, string> = {}
    for (const line of text.split(/\r?\n/)) {
      const match = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line)
      if (match) config[match[1]] = match[2].replace(/^['"]|['"]$/g, '').trim()
    }
    cachedConfig = config
    return config
  } catch {
    return null
  }
}

/** electron-updater 的更新缓存 pending 目录 */
function getPendingDir(): string {
  const dirName = readAppUpdateConfig()?.updaterCacheDirName || 'blood-pressure-measurement-updater'
  const base = process.env.LOCALAPPDATA || app.getPath('userData')
  return path.join(base, dirName, 'pending')
}

/** 目标安装包的落盘路径（与 electron-updater 缓存命名保持一致） */
function targetFileFor(info: UpdateInfoShape): string | null {
  const url = info.files?.[0]?.url
  if (!url) return null
  return path.join(getPendingDir(), decodeURIComponent(path.basename(url)))
}

/** 读取已下载进度（用于「可续传」展示） */
function partialInfo(info: UpdateInfoShape): {
  transferred: number
  percent: number
  resumable: boolean
} {
  const file = targetFileFor(info)
  if (!file) return { transferred: 0, percent: 0, resumable: false }
  let bytes = 0
  try {
    bytes = existsSync(file) ? statSync(file).size : 0
  } catch {
    bytes = 0
  }
  const total = info.files?.[0]?.size ?? 0
  if (bytes <= 0) return { transferred: 0, percent: 0, resumable: false }
  if (total > 0 && bytes >= total) return { transferred: total, percent: 100, resumable: false }
  const percent = total > 0 ? Math.round((bytes / total) * 1000) / 10 : 0
  return { transferred: bytes, percent, resumable: true }
}

/** 解析安装包直链：优先交给 electron-updater 的 provider，失败则按 app-update.yml 构造 */
function resolveDownloadUrl(info: UpdateInfoShape, fileName: string): string | null {
  const provider = (
    autoUpdater as unknown as {
      updateInfoAndProvider?: {
        provider?: { resolveFiles?: (value: unknown) => Array<{ url: URL }> }
      }
    }
  ).updateInfoAndProvider?.provider
  try {
    const resolved = provider?.resolveFiles?.(info)
    const url = resolved?.[0]?.url
    if (url) return url.toString()
  } catch {
    // 忽略，走回退
  }
  const config = readAppUpdateConfig()
  if (config?.provider === 'github' && config.owner && config.repo) {
    const tag = info.version.startsWith('v') ? info.version : `v${info.version}`
    return `https://github.com/${config.owner}/${config.repo}/releases/download/${tag}/${encodeURIComponent(fileName)}`
  }
  return null
}

/** 初始化更新器（仅绑定事件，不自动检查） */
export function initUpdater(): void {
  try {
    autoUpdater.autoDownload = false
    autoUpdater.forceDevUpdateConfig = true
    autoUpdater.disableWebInstaller = false
    autoUpdater.logger = logger

    autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking', message: '' }))

    autoUpdater.on('update-available', (info) => {
      lastUpdateInfo = info as unknown as UpdateInfoShape
      const partial = partialInfo(lastUpdateInfo)
      setStatus({
        state: 'available',
        currentVersion: app.getVersion(),
        version: info.version,
        releaseName: (info as { releaseName?: string | null }).releaseName ?? undefined,
        releaseDate: (info as { releaseDate?: string }).releaseDate,
        releaseNotes: formatReleaseNotes(info.releaseNotes),
        sizeBytes: firstFileSize(info),
        total: firstFileSize(info),
        transferred: partial.transferred,
        percent: partial.percent,
        resumable: partial.resumable,
        bytesPerSecond: 0,
        message: ''
      })
    })

    autoUpdater.on('update-not-available', () =>
      setStatus({
        state: 'not-available',
        currentVersion: app.getVersion(),
        transferred: 0,
        percent: 0,
        resumable: false,
        message: ''
      })
    )

    autoUpdater.on('download-progress', (progress) =>
      setStatus({
        state: 'downloading',
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond
      })
    )

    autoUpdater.on('update-downloaded', (info) => {
      setStatus({
        state: 'downloaded',
        currentVersion: app.getVersion(),
        version: info.version,
        percent: 100,
        bytesPerSecond: 0,
        resumable: false
      })
    })

    autoUpdater.on('update-cancelled', () => setStatus({ state: 'paused', resumable: true }))

    autoUpdater.on('error', (error) => {
      // 主动取消不视为错误
      if ((error as { name?: string })?.name === 'CancellationError') return
      setStatus({ state: 'error', message: error.message, bytesPerSecond: 0 })
    })
  } catch (error) {
    logger.warn('[update] init failed', error)
  }
}

/** 检查更新 */
export async function checkForUpdate(): Promise<UpdateStatus> {
  try {
    setStatus({ state: 'checking', message: '' })
    const result = await autoUpdater.checkForUpdates()
    if (result?.updateInfo) {
      lastUpdateInfo = result.updateInfo as unknown as UpdateInfoShape
    }
  } catch (error) {
    setStatus({ state: 'error', message: (error as Error).message })
  }
  return status
}

/** 下载（无进度时开始；有未完成下载时续传） */
export async function startDownload(): Promise<UpdateStatus> {
  if (downloader?.isRunning) return status

  // 已存在暂停中的下载器：继续
  if (downloader) {
    setStatus({ state: 'downloading' })
    downloader.start()
    return status
  }

  if (!lastUpdateInfo) {
    await checkForUpdate()
  }
  const info = lastUpdateInfo
  const file = info?.files?.[0]
  if (!info || !file?.url) {
    setStatus({ state: 'error', message: '没有可用的更新，请先检查更新' })
    return status
  }

  const fileName = decodeURIComponent(path.basename(file.url))
  const targetFile = path.join(getPendingDir(), fileName)
  const url = resolveDownloadUrl(info, fileName)
  if (!url) {
    setStatus({ state: 'error', message: '无法解析更新下载地址' })
    return status
  }

  const total = file.size ?? status.sizeBytes ?? 0
  const partial = partialInfo(info)
  setStatus({
    state: 'downloading',
    currentVersion: app.getVersion(),
    version: info.version,
    sizeBytes: total,
    total,
    transferred: partial.transferred,
    percent: partial.percent,
    resumable: partial.resumable,
    bytesPerSecond: 0,
    message: ''
  })

  downloader = new ResumableDownloader({
    url,
    targetFile,
    sha512: file.sha512,
    totalBytes: total,
    onProgress: (progress) =>
      setStatus({
        state: 'downloading',
        transferred: progress.transferred,
        total: progress.total,
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond
      }),
    onComplete: (filePath) => void adoptDownloaded(fileName, file.sha512 ?? '', filePath),
    onError: (error) =>
      setStatus({ state: 'error', message: error.message, bytesPerSecond: 0, resumable: false })
  })
  downloader.start()
  return status
}

/** 自定义下载完成后写入缓存元数据，并交给 electron-updater 复用与触发完成事件 */
async function adoptDownloaded(fileName: string, sha512: string, filePath: string): Promise<void> {
  try {
    writeFileSync(
      path.join(getPendingDir(), 'update-info.json'),
      JSON.stringify({ fileName, sha512, isAdminRightsRequired: false })
    )
  } catch (error) {
    logger.warn('[update] write update-info.json failed', error)
  }
  logger.info('[update] download finished, adopt cached file', { filePath })
  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    setStatus({ state: 'error', message: (error as Error).message })
  }
}

/** 暂停下载（保留进度，可续传） */
export function pauseDownload(): UpdateStatus {
  if (downloader?.isRunning) {
    downloader.pause()
    setStatus({
      state: 'paused',
      resumable: true,
      transferred: downloader.partialBytes,
      bytesPerSecond: 0
    })
  } else {
    setStatus({ state: 'paused', resumable: downloader != null })
  }
  return status
}

/** 取消更新并清除已下载进度 */
export function cancelDownload(): UpdateStatus {
  try {
    downloader?.cancel()
  } catch {
    // 忽略
  }
  downloader = null
  const total = lastUpdateInfo?.files?.[0]?.size ?? status.sizeBytes
  setStatus({
    state: 'available',
    sizeBytes: total,
    total,
    transferred: 0,
    percent: 0,
    bytesPerSecond: 0,
    resumable: false,
    message: ''
  })
  return status
}

/** 退出并安装 */
export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}
