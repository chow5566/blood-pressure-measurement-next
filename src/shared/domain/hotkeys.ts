/**
 * 快捷键注册表（单一数据源，主进程与渲染进程共用）。
 *
 * 约定：
 * - 每个可配置快捷键在此登记 id / 名称 / 说明 / 分类 / 作用域 / 默认值；
 * - 默认值、设置页清单、作用域分发均由此派生，避免多处重复维护；
 * - `scope` 用于区分页面/弹窗上下文，命中时按作用域栈优先级匹配。
 */
import type { PhotoHotkey } from './app'

/** 快捷键作用域：页面级上下文（弹窗场景复用所属页面作用域） */
export type HotkeyScope =
  'collect' | 'bscan-history' | 'bscan-template' | 'bp-measure' | 'bp-history'

/** 单个快捷键定义 */
export interface HotkeyDef {
  /** 唯一 id（持久化键名） */
  id: string
  /** 功能名称 */
  label: string
  /** 说明 */
  desc: string
  /** 分组（设置页展示） */
  category: string
  /** 作用域 */
  scope: HotkeyScope
  /** 默认组合键 */
  default: PhotoHotkey
  /** 是否允许在输入框聚焦时触发（默认 false） */
  allowInInput?: boolean
}

/** 快捷键定义清单 */
export const HOTKEY_DEFS: HotkeyDef[] = [
  // ── B超采集 ───────────────────────────────────────
  {
    id: 'takePhoto',
    label: '采集一帧',
    desc: '采集页按此键采集当前画面',
    category: 'B超采集',
    scope: 'collect',
    default: { key: 'F3', ctrl: false, alt: false, shift: false }
  },
  {
    id: 'openTemplate',
    label: '选择模板',
    desc: '打开报告模板选择弹窗',
    category: 'B超采集',
    scope: 'collect',
    allowInInput: true,
    default: { key: 'F4', ctrl: false, alt: false, shift: false }
  },
  {
    id: 'saveLocal',
    label: '保存到本地',
    desc: '保存当前检查到本地',
    category: 'B超采集',
    scope: 'collect',
    allowInInput: true,
    default: { key: 'KeyS', ctrl: true, alt: false, shift: false }
  },
  {
    id: 'saveUpload',
    label: '保存并上传',
    desc: '保存到本地并上传服务器',
    category: 'B超采集',
    scope: 'collect',
    allowInInput: true,
    default: { key: 'KeyS', ctrl: true, alt: false, shift: true }
  },
  {
    id: 'changeBarcode',
    label: '切换条码',
    desc: '清空当前表单与图片并切换条码',
    category: 'B超采集',
    scope: 'collect',
    allowInInput: true,
    default: { key: 'KeyB', ctrl: true, alt: false, shift: false }
  },
  {
    id: 'templateAppend',
    label: '模板追加',
    desc: '模板弹窗中，将模板内容追加到诊断',
    category: 'B超采集',
    scope: 'collect',
    allowInInput: true,
    default: { key: 'Enter', ctrl: false, alt: false, shift: false }
  },
  {
    id: 'templateReplace',
    label: '模板替换',
    desc: '模板弹窗中，用模板内容替换诊断',
    category: 'B超采集',
    scope: 'collect',
    allowInInput: true,
    default: { key: 'Enter', ctrl: true, alt: false, shift: false }
  },

  // ── B超历史 ───────────────────────────────────────
  {
    id: 'bscanEdit',
    label: '编辑记录',
    desc: '进入当前记录的就地编辑',
    category: 'B超历史',
    scope: 'bscan-history',
    allowInInput: true,
    default: { key: 'F2', ctrl: false, alt: false, shift: false }
  },
  {
    id: 'bscanSave',
    label: '保存',
    desc: '保存编辑中的记录到本地',
    category: 'B超历史',
    scope: 'bscan-history',
    allowInInput: true,
    default: { key: 'KeyS', ctrl: true, alt: false, shift: false }
  },
  {
    id: 'bscanSaveUpload',
    label: '保存并上传',
    desc: '保存编辑中的记录并上传',
    category: 'B超历史',
    scope: 'bscan-history',
    allowInInput: true,
    default: { key: 'KeyS', ctrl: true, alt: false, shift: true }
  },
  {
    id: 'bscanPreview',
    label: '报告预览',
    desc: '生成并预览当前记录报告',
    category: 'B超历史',
    scope: 'bscan-history',
    allowInInput: true,
    default: { key: 'KeyP', ctrl: true, alt: false, shift: false }
  },
  {
    id: 'bscanBatchUpload',
    label: '批量上传',
    desc: '上传列表中勾选的记录',
    category: 'B超历史',
    scope: 'bscan-history',
    allowInInput: true,
    default: { key: 'KeyU', ctrl: true, alt: false, shift: false }
  },

  // ── 模板维护 ──────────────────────────────────────
  {
    id: 'templateAdd',
    label: '新增节点',
    desc: '新增类型分组或模板',
    category: '模板维护',
    scope: 'bscan-template',
    allowInInput: true,
    default: { key: 'KeyN', ctrl: true, alt: false, shift: false }
  },
  {
    id: 'templateSave',
    label: '保存',
    desc: '保存编辑中的模板',
    category: '模板维护',
    scope: 'bscan-template',
    allowInInput: true,
    default: { key: 'KeyS', ctrl: true, alt: false, shift: false }
  },
  {
    id: 'templateDelete',
    label: '删除节点',
    desc: '删除当前选中的节点',
    category: '模板维护',
    scope: 'bscan-template',
    default: { key: 'Delete', ctrl: false, alt: false, shift: false }
  },
  {
    id: 'templateRefresh',
    label: '获取公共模板',
    desc: '从服务器获取公共模板并覆盖本地',
    category: '模板维护',
    scope: 'bscan-template',
    allowInInput: true,
    default: { key: 'F5', ctrl: false, alt: false, shift: false }
  },

  // ── 血压历史 ──────────────────────────────────────
  {
    id: 'bpUpload',
    label: '上传选中',
    desc: '上传列表中勾选的记录',
    category: '血压历史',
    scope: 'bp-history',
    allowInInput: true,
    default: { key: 'KeyU', ctrl: true, alt: false, shift: false }
  }
]

/** 由注册表派生的默认快捷键表 */
export const DEFAULT_HOTKEYS: Record<string, PhotoHotkey> = Object.fromEntries(
  HOTKEY_DEFS.map((def) => [def.id, def.default])
)

/** 按分类分组（保持注册表顺序），供设置页渲染 */
export function groupedHotkeyDefs(): { category: string; items: HotkeyDef[] }[] {
  const groups: { category: string; items: HotkeyDef[] }[] = []
  for (const def of HOTKEY_DEFS) {
    let group = groups.find((item) => item.category === def.category)
    if (!group) {
      group = { category: def.category, items: [] }
      groups.push(group)
    }
    group.items.push(def)
  }
  return groups
}
