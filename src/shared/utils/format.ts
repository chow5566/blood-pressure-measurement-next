/** 通用格式化工具（主进程与渲染进程共用） */

/** 字节数可读化：1024 进制，如 1.5 GB */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / Math.pow(1024, index)
  return `${value.toFixed(value >= 100 || index === 0 ? 0 : 1)} ${units[index]}`
}

/** 百分比（0~100，取整） */
export function toPercent(part: number, total: number): number {
  if (!total || total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((part / total) * 100)))
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

/** 格式化为 'YYYY-MM-DD HH:mm:ss'（本地时区） */
export function formatDateTime(date: Date = new Date()): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

/** 格式化为 'YYYY-MM-DD'（本地时区） */
export function formatDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 按出生日期计算年龄（不精确到月，与旧实现一致） */
export function ageFromBirthday(birthday: string | Date | null | undefined): number | null {
  if (!birthday) return null
  const date = birthday instanceof Date ? birthday : new Date(String(birthday).replace(/-/g, '/'))
  if (Number.isNaN(date.getTime())) return null
  return new Date().getFullYear() - date.getFullYear()
}
