import { createHash } from 'node:crypto'
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync
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

/** 断点身份（写入 sidecar，避免复用不相关/损坏的断点） */
export interface DownloadIdentity {
  /** 目标版本号 */
  version?: string
  /** 期望 sha512（base64） */
  sha512?: string
  /** 期望总字节 */
  total?: number
}

/** 重试策略（针对不稳定的网络，如国内直连 GitHub） */
export interface RetryPolicy {
  /** 单次会话内最大网络尝试次数（含首次），超过则报错并可手动重试 */
  maxAttempts: number
  /** 首次退避时长（毫秒） */
  baseDelayMs: number
  /** 退避上限（毫秒） */
  maxDelayMs: number
  /** 卡死判定：超过该时长无任何数据则断开并重试（毫秒） */
  stallTimeoutMs: number
}

/** 重试事件（用于向 UI 透出） */
export interface RetryInfo {
  attempt: number
  maxAttempts: number
  delayMs: number
  offline: boolean
  reason: string
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
  /** 断点身份；用于校验磁盘上已有的部分文件是否属于本次下载 */
  identity?: DownloadIdentity
  retry?: Partial<RetryPolicy>
  onProgress?: (progress: DownloadProgress) => void
  onRetry?: (info: RetryInfo) => void
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

interface BreakpointMeta {
  version?: string
  sha512?: string
  total?: number
}

const EMIT_INTERVAL_MS = 500
const TEARDOWN_TIMEOUT_MS = 800
const OFFLINE_CHECK_MS = 5000
const STALL_CHECK_MS = 5000

const DEFAULT_RETRY: RetryPolicy = {
  maxAttempts: 8,
  baseDelayMs: 2000,
  maxDelayMs: 60000,
  stallTimeoutMs: 30000
}

/** 将证书类错误转为更易读的提示 */
function friendlyError(error: Error): Error {
  const message = error?.message || String(error)
  if (/certificate|CERT_|SSL|TLS|unable to verify/i.test(message)) {
    return new Error(`下载时证书校验失败：${message}（请检查系统时间/网络代理或证书配置）`)
  }
  return error
}

/** 判断是否在线 */
function isOnline(): boolean {
  try {
    return net.isOnline()
  } catch {
    return true
  }
}

/** 是否属于「可重试」的传输错误（网络中断/超时/临时 5xx/429/408） */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status < 600)
}

/**
 * 可断点续传 + 断网自动重试的下载器（基于 Electron net，使用系统证书库与代理）。
 *
 * 可靠性设计：
 * - 每次 `start()` 生成世代号 `token`；每次网络尝试再有 `attemptToken`；过期回调一律丢弃。
 * - 网络中断/超时/5xx/429 自动按指数退避重试，并从磁盘断点续传（Range）。
 * - 离线时进入等待，联网后自动继续；不消耗重试次数。
 * - 卡死检测：长时间无数据则断开重试。
 * - 断点带 sidecar 元数据，身份不匹配则丢弃重下；完成时校验 sha512，失败自动重下一次再报错。
 */
export class ResumableDownloader {
  private token = 0
  private runAttempt = 0
  private phase: Phase = 'idle'
  private settled = false
  private request: Electron.ClientRequest | null = null
  private response: ElectronResponse | null = null
  private stream: WriteStream | null = null
  private transferred = 0
  private total: number
  private speed = 0
  private attempt = 1
  private hashRetries = 0
  private lastEmit = 0
  private lastBytes = 0
  private lastTime = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private stallTimer: ReturnType<typeof setInterval> | null = null
  private lastDataAt = 0
  private readonly metaFile: string
  private readonly policy: RetryPolicy

  constructor(private readonly options: ResumableDownloadOptions) {
    this.total = options.totalBytes && options.totalBytes > 0 ? options.totalBytes : 0
    this.metaFile = `${options.targetFile}.meta.json`
    this.policy = { ...DEFAULT_RETRY, ...(options.retry ?? {}) }
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
    const token = ++this.token
    this.phase = 'running'
    this.settled = false
    this.attempt = 1
    this.hashRetries = 0
    mkdirSync(dirname(this.options.targetFile), { recursive: true })

    if (!this.identityMatches()) {
      this.removePartial()
      this.removeMeta()
    }
    this.writeMeta()

    const existing = this.partialBytes
    if (this.total > 0 && existing >= this.total) {
      this.transferred = existing
      this.verify(token)
      return
    }
    this.beginAttempt(token, existing > 0 ? existing : 0)
  }

  /** 暂停：保留断点，可再次 start 续传；返回时底层请求/写流已关闭 */
  async pause(): Promise<void> {
    if (this.phase !== 'running') return
    this.phase = 'paused'
    this.clearTimers()
    await this.teardown()
  }

  /** 取消：删除断点文件与元数据 */
  async cancel(): Promise<void> {
    this.settled = true
    this.phase = 'idle'
    this.clearTimers()
    await this.teardown()
    this.removePartial()
    this.removeMeta()
  }

  // ── 内部实现 ─────────────────────────────────────────

  private isActive(token: number): boolean {
    return token === this.token && this.phase === 'running' && !this.settled
  }

  private isAttemptActive(token: number, attemptToken: number): boolean {
    return this.isActive(token) && attemptToken === this.runAttempt
  }

  private beginAttempt(token: number, startAt: number): void {
    if (!this.isActive(token)) return
    if (!isOnline()) {
      this.scheduleRetry(token, '网络未连接')
      return
    }
    const attemptToken = ++this.runAttempt
    this.transferred = startAt
    this.lastBytes = startAt
    this.lastTime = Date.now()
    this.lastEmit = 0
    this.lastDataAt = Date.now()
    this.startStallWatch(token, attemptToken)
    this.fetch(token, attemptToken, startAt)
  }

  private backoffDelay(): number {
    const exp = Math.min(this.policy.maxDelayMs, this.policy.baseDelayMs * 2 ** (this.attempt - 1))
    const jitter = Math.random() * this.policy.baseDelayMs
    return Math.min(this.policy.maxDelayMs, Math.round(exp + jitter))
  }

  /** 处理可重试的传输错误：退避后从断点继续 */
  private handleTransient(token: number, reason: string): void {
    if (!this.isActive(token)) return
    // 作废当前尝试：避免同一错误被多个回调重复触发
    this.runAttempt++
    this.abortNow()
    this.clearStall()
    if (this.attempt >= this.policy.maxAttempts) {
      this.fail(
        token,
        new Error(`网络多次中断（已尝试 ${this.attempt} 次）：${reason}。已保留进度，可稍后重试。`)
      )
      return
    }
    this.attempt++
    this.scheduleRetry(token, reason)
  }

  private scheduleRetry(token: number, reason: string): void {
    if (!this.isActive(token)) return
    const offline = !isOnline()
    const delayMs = offline ? OFFLINE_CHECK_MS : this.backoffDelay()
    this.options.onRetry?.({
      attempt: this.attempt,
      maxAttempts: this.policy.maxAttempts,
      delayMs,
      offline,
      reason
    })
    this.clearRetry()
    this.retryTimer = setTimeout(() => {
      if (!this.isActive(token)) return
      if (!isOnline()) {
        this.scheduleRetry(token, '网络未连接')
        return
      }
      this.beginAttempt(token, this.partialBytes)
    }, delayMs)
  }

  /** 单一定时器轮询卡死：避免每个数据块都重置定时器 */
  private startStallWatch(token: number, attemptToken: number): void {
    this.clearStall()
    this.stallTimer = setInterval(() => {
      if (!this.isAttemptActive(token, attemptToken)) return
      if (Date.now() - this.lastDataAt > this.policy.stallTimeoutMs) {
        this.handleTransient(token, '连接超时（长时间无数据）')
      }
    }, STALL_CHECK_MS)
  }

  private clearRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  private clearStall(): void {
    if (this.stallTimer) {
      clearInterval(this.stallTimer)
      this.stallTimer = null
    }
  }

  private clearTimers(): void {
    this.clearRetry()
    this.clearStall()
  }

  private identityMatches(): boolean {
    if (!existsSync(this.metaFile)) return false
    try {
      const meta = JSON.parse(readFileSync(this.metaFile, 'utf-8')) as BreakpointMeta
      const expected = this.options.identity
      return (
        meta.sha512 === this.options.sha512 &&
        meta.total === this.options.totalBytes &&
        meta.version === expected?.version
      )
    } catch {
      return false
    }
  }

  private writeMeta(): void {
    const meta: BreakpointMeta = {
      version: this.options.identity?.version,
      sha512: this.options.sha512,
      total: this.options.totalBytes
    }
    try {
      writeFileSync(this.metaFile, JSON.stringify(meta))
    } catch {
      // 元数据写失败不阻塞下载
    }
  }

  private removePartial(): void {
    try {
      if (existsSync(this.options.targetFile)) unlinkSync(this.options.targetFile)
    } catch {
      // ignore
    }
  }

  private removeMeta(): void {
    try {
      if (existsSync(this.metaFile)) unlinkSync(this.metaFile)
    } catch {
      // ignore
    }
  }

  /** 立即销毁当前请求/响应/写流（不等待） */
  private abortNow(): void {
    const response = this.response
    const request = this.request
    const stream = this.stream
    this.response = null
    this.request = null
    this.stream = null
    try {
      stream?.destroy()
    } catch {
      // ignore
    }
    try {
      response?.destroy?.()
    } catch {
      // ignore
    }
    try {
      request?.abort()
    } catch {
      // ignore
    }
  }

  /** 销毁并等待底层真正关闭 */
  private teardown(): Promise<void> {
    const request = this.request
    this.abortNow()
    return new Promise((resolve) => {
      if (!request) {
        resolve()
        return
      }
      let done = false
      const finish = (): void => {
        if (done) return
        done = true
        resolve()
      }
      try {
        request.once('close', finish)
        request.once('abort', finish)
      } catch {
        finish()
        return
      }
      setTimeout(finish, TEARDOWN_TIMEOUT_MS)
    })
  }

  private fetch(token: number, attemptToken: number, startAt: number): void {
    if (!this.isAttemptActive(token, attemptToken)) return
    let request: Electron.ClientRequest
    try {
      request = net.request({ method: 'GET', url: this.options.url, redirect: 'follow' })
    } catch (error) {
      this.fail(token, friendlyError(error as Error))
      return
    }
    request.setHeader('User-Agent', 'blood-pressure-measurement-updater')
    request.setHeader('Accept', 'application/octet-stream')
    // 关闭压缩协商，保证字节与 Range 偏移一致
    request.setHeader('Accept-Encoding', 'identity')
    if (startAt > 0) request.setHeader('Range', `bytes=${startAt}-`)
    request.on('response', (response) => {
      const typed = response as ElectronResponse
      if (!this.isAttemptActive(token, attemptToken)) {
        typed.destroy?.()
        return
      }
      this.onResponse(token, attemptToken, typed, startAt)
    })
    request.on('error', (error) => {
      if (this.isAttemptActive(token, attemptToken)) {
        this.handleTransient(token, friendlyError(error).message)
      }
    })
    this.request = request
    request.end()
  }

  private onResponse(
    token: number,
    attemptToken: number,
    response: ElectronResponse,
    startAt: number
  ): void {
    if (!this.isAttemptActive(token, attemptToken)) {
      response.destroy?.()
      return
    }
    this.response = response

    const status = response.statusCode ?? 0

    if (status === 416) {
      response.resume?.()
      this.verify(token)
      return
    }

    if (isRetryableStatus(status)) {
      response.resume?.()
      this.handleTransient(token, `HTTP ${status}`)
      return
    }

    if (status !== 200 && status !== 206) {
      response.resume?.()
      this.fail(token, new Error(`下载失败（HTTP ${status}）`))
      return
    }

    const resumable = startAt > 0 && status === 206

    // 校验 Content-Range 起点；不一致则从头重下，避免拼接错位
    if (resumable) {
      const rangeHeader = response.headers['content-range']
      const rangeText = Array.isArray(rangeHeader) ? rangeHeader[0] : rangeHeader
      const match = rangeText ? /bytes\s+(\d+)-(\d+)\/(\d+|\*)/.exec(rangeText) : null
      if (match) {
        const rangeStart = Number(match[1])
        if (rangeStart !== startAt) {
          response.destroy?.()
          this.removePartial()
          this.transferred = 0
          if (this.isAttemptActive(token, attemptToken)) {
            this.beginAttempt(token, 0)
          }
          return
        }
        const rangeTotal = match[3] !== '*' ? Number(match[3]) : 0
        if (rangeTotal > 0) this.total = rangeTotal
      }
    }

    const lengthHeader = response.headers['content-length']
    const contentLength = Number(
      Array.isArray(lengthHeader) ? lengthHeader[0] : (lengthHeader ?? 0)
    )
    if (contentLength > 0 && this.total <= 0) {
      this.total = (resumable ? startAt : 0) + contentLength
    }
    if (!resumable && startAt > 0) {
      this.transferred = 0
    }

    const stream = createWriteStream(this.options.targetFile, { flags: resumable ? 'a' : 'w' })
    this.stream = stream

    response.on('data', (chunk: Buffer) => {
      if (!this.isAttemptActive(token, attemptToken)) return
      this.lastDataAt = Date.now()
      const canContinue = stream.write(chunk)
      this.transferred += chunk.length
      this.emitProgress()
      if (!canContinue) {
        response.pause?.()
        stream.once('drain', () => {
          if (this.isAttemptActive(token, attemptToken)) response.resume?.()
        })
      }
    })
    response.on('end', () => {
      if (this.isAttemptActive(token, attemptToken)) stream.end()
    })
    response.on('error', (error) => {
      if (this.isAttemptActive(token, attemptToken)) {
        this.handleTransient(token, friendlyError(error).message)
      }
    })
    stream.on('error', (error) => {
      if (this.isAttemptActive(token, attemptToken)) {
        this.handleTransient(token, error.message)
      }
    })
    stream.on('finish', () => {
      if (this.isAttemptActive(token, attemptToken)) this.verify(token)
    })
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

  private verify(token: number): void {
    if (!this.isActive(token)) return
    const file = this.options.targetFile
    if (!this.options.sha512) {
      this.complete(token, file)
      return
    }
    const hash = createHash('sha512')
    const rs = createReadStream(file)
    rs.on('data', (chunk) => hash.update(chunk))
    rs.on('error', (err) => this.fail(token, err))
    rs.on('end', () => {
      if (!this.isActive(token)) return
      const actual = hash.digest('base64')
      if (actual !== this.options.sha512) {
        this.removePartial()
        this.removeMeta()
        // 校验失败：清断点自动重下一次，仍失败则报错
        if (this.hashRetries < 1) {
          this.hashRetries++
          this.attempt = 1
          this.writeMeta()
          this.beginAttempt(token, 0)
          return
        }
        this.fail(token, new Error('安装包校验失败（sha512 不匹配），已清除断点，请重试'))
        return
      }
      this.complete(token, file)
    })
  }

  private complete(token: number, file: string): void {
    if (!this.isActive(token)) return
    this.settled = true
    this.phase = 'done'
    this.clearTimers()
    if (this.total > 0) this.transferred = this.total
    this.emitProgress()
    this.options.onComplete?.(file)
  }

  private fail(token: number, error: Error): void {
    if (token !== this.token || this.phase !== 'running') return
    this.settled = true
    this.phase = 'error'
    this.clearTimers()
    this.abortNow()
    this.options.onError?.(error)
  }
}
