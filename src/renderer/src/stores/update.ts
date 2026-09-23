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
    /** 有变更操作（检查/下载/暂停/取消）进行中，期间忽略重复点击 */
    busy: false,
    skipped: [] as string[]
  }),
  getters: {
    currentVersion: (state) => state.status.currentVersion || '',
    targetVersion: (state) => state.status.version || '',
    releaseNotes: (state) => state.status.releaseNotes || '',
    /** 有可安装的新版本（待下载/已暂停/校验中/已下载） */
    hasUpdate: (state) =>
      ['available', 'downloading', 'paused', 'finalizing', 'downloaded'].includes(
        state.status.state
      ),
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
    /** 串行化变更操作：进行中忽略新的点击，避免并发/竞态 */
    async runAction(task: () => Promise<UpdateStatus>): Promise<void> {
      if (this.busy) return
      this.busy = true
      try {
        this.status = await task()
      } finally {
        this.busy = false
      }
    },
    async check(): Promise<void> {
      await this.runAction(() => updateApi.check())
    },
    async download(): Promise<void> {
      await this.runAction(() => updateApi.download())
    },
    async pause(): Promise<void> {
      await this.runAction(() => updateApi.pause())
    },
    async cancel(): Promise<void> {
      await this.runAction(() => updateApi.cancel())
    },
    install(): void {
      this.visible = false
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
