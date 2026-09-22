import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'bpm.theme'

/**
 * 主题（浅色 / 深色 / 跟随系统）。
 * - 通过给 <html> 加/去 `dark` 类切换（配合 Element Plus 深色变量）；
 * - 持久化到 localStorage，并在 index.html 中预置以避免闪烁。
 */
export const useThemeStore = defineStore('theme', {
  state: () => ({
    mode: (localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system',
    isDark: false
  }),
  actions: {
    /** 初始化：应用当前模式 + 监听系统变化 */
    init(): void {
      this.apply()
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.mode === 'system') this.apply()
      })
    },
    /** 设置模式 */
    setMode(mode: ThemeMode): void {
      this.mode = mode
      localStorage.setItem(STORAGE_KEY, mode)
      this.apply()
    },
    /** 应用主题到 DOM */
    apply(): void {
      const dark =
        this.mode === 'dark' ||
        (this.mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      this.isDark = dark
      document.documentElement.classList.toggle('dark', dark)
    }
  }
})
