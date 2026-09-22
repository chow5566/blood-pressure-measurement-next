import { defineStore } from 'pinia'
import type { BScanImage } from '@shared/domain/b-scan'

/** 视频滤镜参数 */
export interface VideoFilter {
  gray: boolean
  invert: boolean
  brightness: number
  contrast: number
  saturation: number
  hue: number
  blur: number
}

/** 临时采集图片（含仅用于 UI 的 base64） */
export interface TempPic extends BScanImage {
  base64Path: string
  isCheck: 'Y' | 'N'
  sortNum?: number
}

const DEFAULT_FILTER: VideoFilter = {
  gray: false,
  invert: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  blur: 0
}

/**
 * B超采集页状态（单窗口下为内存态；配置类可后续持久化）。
 */
export const useBScanStore = defineStore('bScan', {
  state: () => ({
    pageLoading: false,
    /** 体检类型：GW 公卫 / BS 商业 */
    bScanType: 'GW' as 'GW' | 'BS',
    /** 是否联网查询（表单头部勾选） */
    isOnline: true,
    /** 临时采集图片（最多 20 张，选 4 张入报告） */
    tempPics: [] as TempPic[],
    /** 视频滤镜 */
    videoFilter: { ...DEFAULT_FILTER },
    /** 采集后默认勾选 */
    defaultCheckPic: true
  }),
  actions: {
    addTempPic(pic: TempPic): void {
      this.tempPics.unshift(pic)
    },
    removeTempPic(id: string): void {
      const index = this.tempPics.findIndex((item) => item.id === id)
      if (index > -1) this.tempPics.splice(index, 1)
    },
    removeAllTempPics(): void {
      this.tempPics = []
    },
    resetVideoFilter(): void {
      this.videoFilter = { ...DEFAULT_FILTER }
    },
    /** 已勾选数量 */
    checkedCount(): number {
      return this.tempPics.filter((item) => item.isCheck === 'Y').length
    }
  }
})
