/** 时间格式化工具：统一使用 'YYYY-MM-DD HH:mm:ss'（与旧库/后端一致） */

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

/** 生成迁移/备份用的时间戳片段：YYYYMMDDHHmmss */
export function timestampFragment(date: Date = new Date()): string {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  )
}
