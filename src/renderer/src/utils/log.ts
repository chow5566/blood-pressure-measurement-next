/** 渲染进程日志：转发到主进程文件日志（失败静默） */
export function rendererLog(level: 'info' | 'warn' | 'error', message: string): void {
  try {
    void window.api.invoke('log:renderer', level, message)
  } catch {
    // 忽略：日志失败不应影响业务
  }
}
