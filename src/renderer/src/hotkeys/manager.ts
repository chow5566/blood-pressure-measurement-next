import { ref } from 'vue'
import type { PhotoHotkey } from '@shared/domain/app'
import { HOTKEY_DEFS, type HotkeyDef, type HotkeyScope } from '@shared/domain/hotkeys'
import { matchesHotkey } from '@r/utils/hotkey'

/**
 * 快捷键运行时管理器（单例）。
 *
 * - 全局只注册一个捕获阶段的 keydown 监听；
 * - 通过「作用域栈」按 栈顶(弹窗) → 页面 → 全局 的优先级分发；
 * - 命中后按定义 preventDefault/stopPropagation，并跳过输入框（除非 allowInInput）；
 * - 忽略长按重复(event.repeat)与输入法组合态(event.isComposing)。
 */
type HotkeyHandler = (event: KeyboardEvent) => void

const defsById = new Map<string, HotkeyDef>(HOTKEY_DEFS.map((def) => [def.id, def]))

/** 作用域栈（栈顶优先级最高） */
const scopeStack = ref<HotkeyScope[]>([])
/** scope -> (id -> handler) */
const registry = new Map<HotkeyScope, Map<string, HotkeyHandler>>()

let configGetter: () => Record<string, PhotoHotkey> = () => ({})
let installed = false

/** 注入快捷键配置读取函数（通常为 config store 的 hotkeys） */
export function configureHotkeys(getter: () => Record<string, PhotoHotkey>): void {
  configGetter = getter
}

/** 设置当前页面作用域（替换除全局兜底外的页面作用域） */
export function setPageScope(scope: HotkeyScope | null): void {
  scopeStack.value = scope ? [scope] : []
}

/** 压入弹窗等临时作用域（栈顶优先） */
export function pushScope(scope: HotkeyScope): void {
  if (scopeStack.value[scopeStack.value.length - 1] !== scope) scopeStack.value.push(scope)
}

/** 弹出作用域（不传则弹出栈顶） */
export function popScope(scope?: HotkeyScope): void {
  const stack = scopeStack.value
  if (!stack.length) return
  if (!scope) {
    stack.pop()
    return
  }
  const index = stack.lastIndexOf(scope)
  if (index > -1) stack.splice(index, 1)
}

/** 注册某作用域下的快捷键处理器，返回注销函数 */
export function registerHotkey(scope: HotkeyScope, id: string, handler: HotkeyHandler): () => void {
  let map = registry.get(scope)
  if (!map) {
    map = new Map()
    registry.set(scope, map)
  }
  map.set(id, handler)
  return () => {
    const current = registry.get(scope)
    if (!current) return
    current.delete(id)
    if (!current.size) registry.delete(scope)
  }
}

/** 目标是否为输入类元素 */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable === true
}

/** 是否为功能键（F1–F12）：功能键不产生字符输入，聚焦输入框时也允许触发 */
function isFunctionKey(code: string): boolean {
  return /^F([1-9]|1[0-2])$/.test(code)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.repeat || event.isComposing) return
  const config = configGetter()

  const scopes = [...scopeStack.value].reverse()
  for (const scope of scopes) {
    const handlers = registry.get(scope)
    if (!handlers) continue
    for (const [id, handler] of handlers) {
      const def = defsById.get(id)
      const combo = config[id] ?? def?.default
      if (!combo || !combo.key || !matchesHotkey(event, combo)) continue
      // 输入框聚焦时：除显式 allowInInput 外，仅放行功能键
      if (isTypingTarget(event.target) && !def?.allowInInput && !isFunctionKey(combo.key)) continue
      event.preventDefault()
      event.stopPropagation()
      handler(event)
      return
    }
  }
}

/** 安装全局监听（幂等） */
export function installHotkeys(): void {
  if (installed) return
  installed = true
  window.addEventListener('keydown', onKeydown, true)
}
