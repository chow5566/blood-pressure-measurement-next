import { createHash } from 'node:crypto'
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  statSync,
  unlinkSync
} from 'node:fs'
import { dirname } from 'node:path'
import { net } from 'electron'
import type { WriteStream } from 'node:fs'

/** 下载进度 */
export interface DownloadProgress {
  /** 已下载字节 */
  transferred: number
  /** 总字节（未知时为 0） */
  total: number
  /** 进度 0~100 */
  percent: number
  /** 速度（字节/秒） */
  bytesPerSecond: number
}

export interface ResumableDownloadOptions {
  /** 直链（自动跟随 302 跳转） */
  url: string
  /** 落盘路径（最终文件，非临时名） */
  targetFile: string
  /** 期望 sha512（base64）；为空则跳过校验 */
  sha512?: string
  /** 期望总字节（未知填 0） */
  totalBytes?: number
  onProgress?: (progress: DownloadProgress) => void
  onComplete?: (filePath: string) => void
  onError?: (error: Error) => void
}

type Phase = 'idle' | 'running' | 'paused' | 'done' | 'error'

/** Electron 的 IncomingMessage 运行期是 Readable，但类型未声明，这里补充用到的成员 */
type ElectronResponse = Electron.IncomingMessage & {
  pause?: () => void
  resume?: () => void
  destroy?: () => void
}

const EMIT_INTERVAL_MS = 200

/** 将证书类错误转为更易读的提示 */
function friendlyError(error: Error): Error {
  const message = error?.message || String(error)
  if (/certificate|CERT_|SSL|TLS|unable to verify/i.test(message)) {
    return new Error(`下载时证书校验失败：${message}（请检查系统时间/网络代理或证书配置）`)
  }
  return error
}

/**
 * 可断点续传下载器（基于 Electron net，使用系统证书库与代理设置）。
 *
 * - 使用 HTTP Range 从已下载位置续传（服务端返回 206 时）。
 * - 暂停保留已下载文件；取消删除之。
 * - 完成后按 sha512 校验，失败删除并报错。
 * - 不依赖 electron-updater 的下载实现，仅用于把安装包落到其缓存目录后交接。
 */
export class ResumableDownloader {
  private request: Electron.ClientRequest | null = null
  private stream: WriteStream | null = null
  private phase: Phase = 'idle'
  private settled = false
  private transferred = 0
  private total: number
  private speed = 0
  private lastEmit = 0
  private lastBytes = 0
  private lastTime = 0

  constructor(private readonly options: ResumableDownloadOptions) {
    this.total = options.totalBytes && options.totalBytes > 0 ? options.totalBytes : 0
  }

  /** 当前已落盘的字节数（用于「可续传」判断与展示） */
  get partialBytes(): number {
    try {
      return existsSync(this.options.targetFile) ? statSync(this.options.targetFile).size : 0
    } catch {
      return 0
    }
  }

  get isRunning(): boolean {
    return this.phase === 'running'
  }

  start(): void {
    if (this.phase === 'running' || this.phase === 'done') return
    this.phase = 'running'
    this.settled = false
    mkdirSync(dirname(this.options.targetFile), { recursive: true })

    const existing = this.partialBytes
    if (this.total > 0 && existing >= this.total) {
      this.transferred = existing
      this.verify()
      return
    }

    const startAt = existing > 0 ? existing : 0
    this.transferred = startAt
    this.lastBytes = startAt
    this.lastTime = Date.now()
    this.lastEmit = 0
    this.fetch(startAt)
  }

  /** 暂停：保留已下载文件，可再次 start 续传 */
  pause(): void {
    if (this.phase !== 'running') return
    this.phase = 'paused'
    this.abort()
  }

  /** 取消：删除已下载文件 */
  cancel(): void {
    this.settled = true
    this.phase = 'idle'
    this.abort()
    this.removePartial()
  }

  private removePartial(): void {
    try {
      if (existsSync(this.options.targetFile)) unlinkSync(this.options.targetFile)
    } catch {
      // 忽略删除失败
    }
  }

  private abort(): void {
    try {
      this.request?.abort()
    } catch {
      // ignore
    }
    try {
      this.stream?.destroy()
    } catch {
      // ignore
    }
    this.request = null
    this.stream = null
  }

  private fetch(startAt: number): void {
    let request: Electron.ClientRequest
    try {
      request = net.request({ method: 'GET', url: this.options.url, redirect: 'follow' })
    } catch (error) {
      this.fail(friendlyError(error as Error))
      return
    }
    request.setHeader('User-Agent', 'blood-pressure-measurement-updater')
    request.setHeader('Accept', 'application/octet-stream')
    if (startAt > 0) request.setHeader('Range', `bytes=${startAt}-`)
    request.on('response', (response) => this.onResponse(response as ElectronResponse, startAt))
    request.on('error', (error) => this.fail(friendlyError(error)))
    this.request = request
    request.end()
  }

  private onResponse(response: ElectronResponse, startAt: number): void {
    const status = response.statusCode ?? 0

    if (status === 416) {
      // Range 不可满足：视为已下载完成
      response.resume?.()
      this.verify()
      return
    }

    if (status !== 200 && status !== 206) {
      response.resume?.()
      this.fail(new Error(`下载失败（HTTP ${status}）`))
      return
    }

    const resumable = startAt > 0 && status === 206
    const lengthHeader = response.headers['content-length']
    const contentLength = Number(
      Array.isArray(lengthHeader) ? lengthHeader[0] : (lengthHeader ?? 0)
    )
    if (contentLength > 0) {
      this.total = (resumable ? startAt : 0) + contentLength
    }
    if (!resumable && startAt > 0) {
      // 服务端不支持续传，从头覆盖
      this.transferred = 0
    }

    const stream = createWriteStream(this.options.targetFile, { flags: resumable ? 'a' : 'w' })
    this.stream = stream
    response.on('data', (chunk: Buffer) => {
      const canContinue = stream.write(chunk)
      this.transferred += chunk.length
      this.emitProgress()
      if (!canContinue) {
        response.pause?.()
        stream.once('drain', () => response.resume?.())
      }
    })
    response.on('end', () => stream.end())
    response.on('error', (error) => this.fail(friendlyError(error)))
    stream.on('error', (error) => this.fail(error))
    stream.on('finish', () => this.verify())
  }

  private emitProgress(): void {
    const now = Date.now()
    const notDone = this.total > 0 && this.transferred < this.total
    if (notDone && now - this.lastEmit < EMIT_INTERVAL_MS) return
    this.lastEmit = now

    const dt = (now - this.lastTime) / 1000
    if (dt > 0.2) {
      this.speed = Math.max(0, (this.transferred - this.lastBytes) / dt)
      this.lastBytes = this.transferred
      this.lastTime = now
    }
    const total = this.total > 0 ? this.total : this.transferred
    const percent =
      total > 0 ? Math.min(100, Math.round((this.transferred / total) * 1000) / 10) : 0
    this.options.onProgress?.({
      transferred: this.transferred,
      total,
      percent,
      bytesPerSecond: this.speed
    })
  }

  private verify(): void {
    const file = this.options.targetFile
    if (!this.options.sha512) {
      this.complete(file)
      return
    }
    const hash = createHash('sha512')
    const rs = createReadStream(file)
    rs.on('data', (chunk) => hash.update(chunk))
    rs.on('error', (err) => this.fail(err))
    rs.on('end', () => {
      const actual = hash.digest('base64')
      if (actual !== this.options.sha512) {
        this.removePartial()
        this.fail(new Error('安装包校验失败（sha512 不匹配），请重试'))
        return
      }
      this.complete(file)
    })
  }

  private complete(file: string): void {
    if (this.settled) return
    this.settled = true
    this.phase = 'done'
    if (this.total > 0) this.transferred = this.total
    this.emitProgress()
    this.options.onComplete?.(file)
  }

  private fail(error: Error): void {
    if (this.settled || this.phase === 'paused') return
    this.settled = true
    this.phase = 'error'
    this.abort()
    this.options.onError?.(error)
  }
}
