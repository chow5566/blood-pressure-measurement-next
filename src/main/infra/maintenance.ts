/**
 * 维护模式：迁移/备份等需要独占数据的操作用它「冻结写入」。
 * 写操作前调用 `assertWritable()`，维护中会抛错，由 IPC 层转为友好提示。
 */
let enabled = false
let reason = ''

export const maintenance = {
  /** 进入维护模式 */
  enable(message = '数据维护中'): void {
    enabled = true
    reason = message
  },
  /** 退出维护模式 */
  disable(): void {
    enabled = false
    reason = ''
  },
  /** 是否处于维护模式 */
  isEnabled(): boolean {
    return enabled
  },
  /** 当前维护原因 */
  getReason(): string {
    return reason
  },
  /** 断言可写；维护中抛错 */
  assertWritable(): void {
    if (enabled) {
      throw new Error(reason || '数据维护中，请稍后重试')
    }
  }
}
