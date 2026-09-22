import { reactive } from 'vue'

export type ToastType = 'info' | 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

/** 轻量提示（替代 ElMessage，自建，无 Element 依赖） */
export const toasts = reactive<ToastItem[]>([])

let seed = 0

export function toast(message: string, type: ToastType = 'info'): void {
  const id = ++seed
  toasts.push({ id, message, type })
  setTimeout(() => {
    const index = toasts.findIndex((item) => item.id === id)
    if (index > -1) toasts.splice(index, 1)
  }, 2800)
}
