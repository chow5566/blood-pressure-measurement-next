import { defineStore } from 'pinia'
import { updateApi } from '@r/api/update'
import {
  clearSkippedVersions,
  getSkippedVersions,
  skipVersion,
  unskipVersion
} from '@r/utils/update'
import type { UpdateStatus } from '@shared/domain/app'

/** 已自动弹过框的版本（避免“稍后”后反复弹出） */
let autoOpenedVersion = ''
let unsubscribe: (() => void) | null = null

/**
 * 更新中心状态：集中维护更新状态、弹框可见性与“已忽略版本”，
 * 供 App 外壳、设置页与更新弹框共享。
 */
export const useUpdateStore = defineStore('update', {
  state: () => ({
    status: { state: 'idle' } as UpdateStatus,
    visible: false,
    initialized: false,
    skipped: [] as string[]
  }),
  getters: {
    currentVersion: (state) => state.status.currentVersion || '',
    targetVersion: (state) => state.status.version || '',
    releaseNotes: (state) => state.status.releaseNotes || '',
    /** 有可安装的新版本（待下载/已暂停/已下载） */
    hasUpdate: (state) =>
      ['available', 'downloading', 'paused', 'downloaded'].includes(state.status.state),
    /** 判断某版本是否在忽略列表中 */
    isSkipped: (state) => (version?: string) => !!version && state.skipped.includes(version)
  },
  actions: {
    /** 初始化：拉取当前状态并订阅主进程推送（幂等） */
    async init(): Promise<void> {
      if (this.initialized) return
      this.initialized = true
      this.skipped = getSkippedVersions()
      this.status = await updateApi.status()
      unsubscribe = updateApi.onStatus((status) => {
        this.status = status
        this.maybeAutoOpen()
      })
      this.maybeAutoOpen()
    },
    dispose(): void {
      unsubscribe?.()
      unsubscribe = null
      this.initialized = false
    },
    /** 发现新版本时自动弹框（忽略的版本不弹） */
    maybeAutoOpen(): void {
      const { state, version } = this.status
      if (state !== 'available' || !version) return
      if (this.skipped.includes(version)) return
      if (version === autoOpenedVersion) return
      autoOpenedVersion = version
      this.visible = true
    },
    open(): void {
      this.visible = true
    },
    close(): void {
      this.visible = false
    },
    async check(): Promise<void> {
      this.status = await updateApi.check()
    },
    async download(): Promise<void> {
      this.status = await updateApi.download()
    },
    async pause(): Promise<void> {
      this.status = await updateApi.pause()
    },
    async cancel(): Promise<void> {
      this.status = await updateApi.cancel()
    },
    install(): void {
      void updateApi.install()
    },
    /** 忽略某版本 */
    skip(version: string): void {
      skipVersion(version)
      this.skipped = getSkippedVersions()
      this.visible = false
    },
    /** 恢复某被忽略版本 */
    unskip(version: string): void {
      unskipVersion(version)
      this.skipped = getSkippedVersions()
    },
    /** 清空忽略记录 */
    clearSkipped(): void {
      clearSkippedVersions()
      this.skipped = getSkippedVersions()
    }
  }
})
