/** 更新“不再提示此版本”的本地记录 */

const SKIP_KEY = 'bpm.skipUpdateVersions'

export function getSkippedVersions(): string[] {
  try {
    const raw = localStorage.getItem(SKIP_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list) ? (list as string[]) : []
  } catch {
    return []
  }
}

export function isSkippedVersion(version?: string): boolean {
  if (!version) return false
  return getSkippedVersions().includes(version)
}

export function skipVersion(version: string): void {
  if (!version) return
  const list = getSkippedVersions()
  if (!list.includes(version)) {
    localStorage.setItem(SKIP_KEY, JSON.stringify([...list, version]))
  }
}

/** 恢复（取消忽略）某个已跳过的版本 */
export function unskipVersion(version: string): void {
  if (!version) return
  const list = getSkippedVersions().filter((item) => item !== version)
  localStorage.setItem(SKIP_KEY, JSON.stringify(list))
}

/** 清空全部忽略记录 */
export function clearSkippedVersions(): void {
  localStorage.removeItem(SKIP_KEY)
}
