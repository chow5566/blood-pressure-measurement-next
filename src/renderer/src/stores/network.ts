import { defineStore } from 'pinia'
import { appApi } from '@r/api/app'
import type { NetStatus } from '@shared/domain/app'

const POLL_MS = 4000
let timer: ReturnType<typeof setInterval> | null = null
let onBrowserOnline: (() => void) | null = null
let onBrowserOffline: (() => void) | null = null
/** 连续探测失败计数：避免偶发失败导致抖动 */
let failCount = 0

/**
 * 网络状态（单例）：统一轮询 + 浏览器 online/offline 事件，
 * 供底栏、B超采集等复用，作为「是否联网」的唯一数据源。
 */
export const useNetworkStore = defineStore('network', {
  state: () => ({
    online: true,
    type: 'wired' as NetStatus['type'],
    wifiSignal: null as number | null,
    wifiSsid: null as string | null,
    /** 最近一次成功检测时间戳 */
    lastCheckedAt: 0
  }),
  getters: {
    /** WiFi 信号格 0~4 */
    wifiBars: (state) => {
      const value = state.wifiSignal ?? 0
      if (value >= 75) return 4
      if (value >= 50) return 3
      if (value >= 25) return 2
      if (value > 0) return 1
      return 0
    },
    /** 悬停/面板标题 */
    title: (state) => {
      if (state.type === 'wifi') {
        const suffix = state.wifiSignal != null ? ` · 信号 ${state.wifiSignal}%` : ''
        return `${state.wifiSsid || 'WiFi'}${suffix}`
      }
      if (state.type === 'wired') return '有线网络'
      return '网络未连接'
    }
  },
  actions: {
    async refresh(): Promise<void> {
      try {
        const status = await appApi.netStatus()
        failCount = 0
        this.online = status.online
        this.type = status.type
        this.wifiSignal = status.wifiSignal
        this.wifiSsid = status.wifiSsid
        this.lastCheckedAt = Date.now()
      } catch {
        failCount++
        if (failCount >= 2) {
          this.online = false
          this.type = 'none'
          this.wifiSignal = null
          this.wifiSsid = null
        }
      }
    },
    /** 启动轮询与事件监听（幂等） */
    start(): void {
      if (timer) return
      void this.refresh()
      timer = setInterval(() => void this.refresh(), POLL_MS)
      onBrowserOnline = () => void this.refresh()
      onBrowserOffline = () => {
        this.online = false
        this.type = 'none'
        this.wifiSignal = null
        this.wifiSsid = null
        this.lastCheckedAt = Date.now()
      }
      window.addEventListener('online', onBrowserOnline)
      window.addEventListener('offline', onBrowserOffline)
    },
    stop(): void {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      if (onBrowserOnline) window.removeEventListener('online', onBrowserOnline)
      if (onBrowserOffline) window.removeEventListener('offline', onBrowserOffline)
      onBrowserOnline = null
      onBrowserOffline = null
    }
  }
})
