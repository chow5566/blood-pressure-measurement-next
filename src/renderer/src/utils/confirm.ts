import { reactive } from 'vue'

interface ConfirmState {
  open: boolean
  title: string
  message: string
  confirmText: string
  cancelText: string
  danger: boolean
}

/** 轻量确认框（替代 ElMessageBox，自建） */
export const confirmState = reactive<ConfirmState>({
  open: false,
  title: '提示',
  message: '',
  confirmText: '确定',
  cancelText: '取消',
  danger: false
})

let resolver: ((value: boolean) => void) | null = null

export function confirmBox(
  message: string,
  options?: { title?: string; confirmText?: string; cancelText?: string; danger?: boolean }
): Promise<boolean> {
  confirmState.open = true
  confirmState.title = options?.title ?? '提示'
  confirmState.message = message
  confirmState.confirmText = options?.confirmText ?? '确定'
  confirmState.cancelText = options?.cancelText ?? '取消'
  confirmState.danger = options?.danger ?? false
  return new Promise<boolean>((resolve) => {
    resolver = resolve
  })
}

export function settleConfirm(value: boolean): void {
  confirmState.open = false
  resolver?.(value)
  resolver = null
}
