import { appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 引导期同步日志：在主进程极早期（app ready 之前）可用，
 * 用于定位「窗口未出现/日志未生成」类问题（尤其 Win7 现场）。
 * 输出到系统临时目录，失败静默，绝不阻塞启动。
 */
const BOOT_LOG = join(tmpdir(), 'blood-pressure-measurement-boot.log')

export function bootLog(message: string, extra?: unknown): void {
  try {
    const time = new Date().toISOString()
    const tail = extra === undefined ? '' : ' ' + safeStringify(extra)
    appendFileSync(BOOT_LOG, `[${time}] ${message}${tail}\n`)
  } catch {
    // ignore
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
