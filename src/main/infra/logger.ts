import log from 'electron-log/main'

/**
 * 统一日志。主进程写文件（%APPDATA%\<appName>\logs），
 * 渲染进程日志后续通过 IPC 汇聚到此处。
 */
export const logger = log

export function initLogger(): void {
  logger.initialize({ preload: true })
  logger.transports.file.level = 'info'
  logger.transports.console.level = 'debug'
  logger.transports.file.maxSize = 5 * 1024 * 1024
  logger.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
}
