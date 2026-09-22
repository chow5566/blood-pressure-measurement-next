/** 最近使用的模板（本地记录，用于选择弹窗置顶） */

const KEY = 'bpm.recentTemplates'
const MAX = 8

export function getRecentTemplateIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list) ? (list as string[]) : []
  } catch {
    return []
  }
}

export function addRecentTemplateId(id: string): void {
  if (!id) return
  const list = getRecentTemplateIds().filter((item) => item !== id)
  list.unshift(id)
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
}
