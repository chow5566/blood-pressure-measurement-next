import { onBeforeUnmount, onMounted } from 'vue'
import type { HotkeyScope } from '@shared/domain/hotkeys'
import { registerHotkey } from './manager'

/**
 * 在组件内注册一个快捷键（挂载时注册、卸载时注销）。
 * 是否真正触发由「当前作用域」与配置决定。
 */
export function useHotkey(
  id: string,
  handler: (event: KeyboardEvent) => void,
  scope: HotkeyScope
): void {
  let dispose: (() => void) | null = null
  onMounted(() => {
    dispose = registerHotkey(scope, id, handler)
  })
  onBeforeUnmount(() => {
    dispose?.()
    dispose = null
  })
}
