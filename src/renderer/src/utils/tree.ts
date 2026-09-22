/**
 * 通用树构造：按 id / parentId 组装（parentId 为 '00' 或不存在视为根）。
 */

export interface TreeItem {
  id?: string
  parentId?: string
  children?: TreeItem[]
}

export function buildTree<T extends TreeItem>(list: T[]): T[] {
  const nodes: T[] = list.map((item) => ({ ...item }))
  const map = new Map<string, T>()

  for (const node of nodes) {
    if (node.id) map.set(node.id, node)
  }

  const roots: T[] = []
  for (const node of nodes) {
    const parentId = node.parentId
    if (parentId && parentId !== '00' && map.has(parentId)) {
      const parent = map.get(parentId) as T
      parent.children = parent.children ?? []
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}
