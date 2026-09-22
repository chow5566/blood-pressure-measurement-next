import type { PhotoHotkey } from '@shared/domain/app'

/** KeyboardEvent.code → 可读键名 */
export function keyLabel(code: string): string {
  if (!code) return '—'
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  if (/^Numpad[0-9]$/.test(code)) return `Num${code.slice(6)}`
  return code
}

/** 组合键 → 显示文本（如 Ctrl + Shift + S） */
export function comboText(hotkey?: PhotoHotkey | null): string {
  if (!hotkey || !hotkey.key) return '未设置'
  const parts: string[] = []
  if (hotkey.ctrl) parts.push('Ctrl')
  if (hotkey.alt) parts.push('Alt')
  if (hotkey.shift) parts.push('Shift')
  parts.push(keyLabel(hotkey.key))
  return parts.join(' + ')
}

/** 判断键盘事件是否匹配某快捷键 */
export function matchesHotkey(event: KeyboardEvent, hotkey?: PhotoHotkey | null): boolean {
  if (!hotkey || !hotkey.key) return false
  return (
    event.code === hotkey.key &&
    event.ctrlKey === hotkey.ctrl &&
    event.altKey === hotkey.alt &&
    event.shiftKey === hotkey.shift
  )
}
