import type {
  BScanImage,
  BScanOperationResult,
  BScanRecord,
  BScanReportParams,
  BScanSaveInput,
  BScanTemplate,
  BScanUploadInput,
  OnlineBScanData
} from '@shared/domain/b-scan'
import type { PageQuery, PageResult } from '@shared/domain/common'

/** B超 API 封装 */
export const bScanApi = {
  /** 生成报告（docx dataURL） */
  renderReport: (params: BScanReportParams): Promise<string> =>
    window.api.invoke('bscan:render-report', params),
  /** 保存记录（含图片落盘） */
  save: (input: BScanSaveInput): Promise<BScanOperationResult> =>
    window.api.invoke('bscan:save', input),
  /** 清空某条码的图片 */
  clearImages: (barcode: string): Promise<BScanOperationResult> =>
    window.api.invoke('bscan:clear-images', barcode),
  /** 分批保存图片 */
  saveImages: (barcode: string, images: BScanImage[]): Promise<BScanOperationResult> =>
    window.api.invoke('bscan:save-images', barcode, images),
  /** 查询单条记录（含图片 base64） */
  get: (barcode: string): Promise<BScanRecord | null> => window.api.invoke('bscan:get', barcode),
  /** 分页查询 */
  pageList: (query: PageQuery): Promise<PageResult<BScanRecord>> =>
    window.api.invoke('bscan:page-list', query),
  /** 上传 */
  upload: (input: BScanUploadInput): Promise<BScanOperationResult> =>
    window.api.invoke('bscan:upload', input),
  /** 删除 */
  remove: (barcodes: string[]): Promise<BScanOperationResult> =>
    window.api.invoke('bscan:delete', barcodes),
  /** 修改条码号（含图片目录迁移） */
  changeBarcode: (oldBarcode: string, newBarcode: string): Promise<BScanOperationResult> =>
    window.api.invoke('bscan:change-barcode', oldBarcode, newBarcode),
  /** 模板列表 */
  templates: (dataType?: string, keyword?: string): Promise<BScanTemplate[]> =>
    window.api.invoke('bscan:templates', dataType, keyword),
  /** 新增/修改模板或类型 */
  templateSave: (template: BScanTemplate): Promise<BScanOperationResult> =>
    window.api.invoke('bscan:template-save', template),
  /** 删除模板或类型 */
  templateDelete: (id: string): Promise<BScanOperationResult> =>
    window.api.invoke('bscan:template-delete', id),
  /** 从服务器获取公共模板并覆盖本地 */
  templateSync: (): Promise<BScanOperationResult> => window.api.invoke('bscan:template-sync'),
  /** 在线查询（需登录） */
  onlineLookup: (barcode: string, type?: string): Promise<OnlineBScanData | null> =>
    window.api.invoke('bscan:online-lookup', barcode, type)
}

/** 每批保存的图片数量（避免一次 IPC 传过多 base64） */
const IMAGE_BATCH_SIZE = 5

/**
 * 分批持久化图片：先清空该条码图片，再按批调用 `bscan:save-images`。
 * 语义等同“整体替换”，但把大 payload 拆成多批。
 */
export async function persistBScanImages(
  barcode: string,
  images: BScanImage[]
): Promise<BScanOperationResult> {
  const cleared = await bScanApi.clearImages(barcode)
  if (!cleared.ok) return cleared
  for (let i = 0; i < images.length; i += IMAGE_BATCH_SIZE) {
    const chunk = images.slice(i, i + IMAGE_BATCH_SIZE)
    const result = await bScanApi.saveImages(barcode, chunk)
    if (!result.ok) return result
  }
  return { ok: true, barcode }
}
