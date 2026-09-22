import { repositories } from '../../infra/database'
import { uploadBScan } from '../../infra/http/uploader'
import { assertSpaceForWrite } from '../../infra/storage'
import { maintenance } from '../../infra/maintenance'
import { getDataDir } from '../../config'
import { imagesDirOfBarcode } from '../../infra/storage/storage-paths'
import { formatDateTime } from '../../../shared/utils/format'
import { logger } from '../../infra/logger'
import { generateBScanReport } from './report'
import {
  hydrateBScanImages,
  moveBScanImageDir,
  persistBScanImages,
  removeBScanImageDir
} from './image-store'
import { fetchPublicTemplates } from './online'
import type {
  BScanImage,
  BScanOperationResult,
  BScanRecord,
  BScanReportParams,
  BScanSaveInput,
  BScanTemplate,
  BScanUploadInput
} from '../../../shared/domain/b-scan'
import type { PageQuery, PageResult } from '../../../shared/domain/common'

/**
 * B超业务服务：保存、查询、删除、报告生成与上传。
 * 原项目逻辑分散在渲染进程（js/index.js）与主进程服务中，这里统一收敛到主进程。
 */

/** 生成报告（返回 docx dataURL） */
export function buildBScanReport(params: BScanReportParams): Promise<string> {
  return generateBScanReport(params)
}

/**
 * 保存 B超记录（含图片）。
 * - 图片 base64 落盘，数据库只存 localPath；
 * - 记录 upsert，图片整体替换。
 */
export async function saveBScan(input: BScanSaveInput): Promise<BScanOperationResult> {
  const barcode = input.record?.barcode?.trim()
  if (!barcode) {
    return { ok: false, message: '条码号不能为空' }
  }

  // 磁盘空间守卫
  await assertSpaceForWrite()
  maintenance.assertWritable()

  const isUpload = input.isUpload ?? 'N'
  // 1) 记录 upsert
  repositories.bScan.upsert({ ...input.record, barcode, isUpload })
  // 2) 图片落盘 + 整体替换（仅在传入图片时；分批保存见 saveBScanImages）
  if (input.images && input.images.length > 0) {
    const persisted = await persistBScanImages(barcode, input.images)
    repositories.bScanImages.replaceForBarcode(
      barcode,
      persisted.map((image) => ({ ...image, barcode, base64Path: null }))
    )
  }

  return { ok: true, barcode }
}

/** 清空某条码的图片（分批保存前调用） */
export function clearBScanImages(barcode: string): BScanOperationResult {
  maintenance.assertWritable()
  repositories.bScanImages.deleteByBarcode(barcode)
  return { ok: true, barcode }
}

/** 分批保存图片（按 id 追加/更新，不删除其它） */
export async function saveBScanImages(
  barcode: string,
  images: BScanImage[]
): Promise<BScanOperationResult> {
  if (!barcode) {
    return { ok: false, message: '条码号不能为空' }
  }
  maintenance.assertWritable()
  const persisted = await persistBScanImages(barcode, images ?? [])
  repositories.bScanImages.upsertMany(
    persisted.map((image) => ({ ...image, barcode, base64Path: null }))
  )
  return { ok: true, barcode }
}

/** 查询单条记录（含图片 base64，用于展示/报告） */
export async function getBScan(barcode: string): Promise<BScanRecord | null> {
  const record = repositories.bScan.findByBarcode(barcode)
  if (!record) return null
  const images = await hydrateBScanImages(repositories.bScanImages.listByBarcode(barcode))
  return { ...record, images }
}

/** 分页查询（列表，不含图片） */
export function pageBScan(query: PageQuery): PageResult<BScanRecord> {
  return repositories.bScan.query(query)
}

/** 删除记录（含图片文件） */
export async function deleteBScan(barcodes: string[]): Promise<BScanOperationResult> {
  maintenance.assertWritable()
  for (const barcode of barcodes ?? []) {
    repositories.bScanImages.deleteByBarcode(barcode)
    repositories.bScan.delete(barcode)
    await removeBScanImageDir(barcode)
  }
  return { ok: true }
}

/** 修改条码号（同时迁移图片目录与图片记录） */
export async function changeBScanBarcode(
  oldBarcode: string,
  newBarcode: string
): Promise<BScanOperationResult> {
  const from = oldBarcode?.trim()
  const to = newBarcode?.trim()
  if (!from || !to) {
    return { ok: false, message: '条码号不能为空' }
  }
  maintenance.assertWritable()
  if (from === to) {
    return { ok: true, barcode: to }
  }
  if (repositories.bScan.findByBarcode(to)) {
    return { ok: false, message: '新条码号已存在' }
  }
  if (!repositories.bScan.findByBarcode(from)) {
    return { ok: false, message: '原记录不存在' }
  }

  const base = getDataDir()
  const oldDir = imagesDirOfBarcode(base, from)
  const newDir = imagesDirOfBarcode(base, to)

  await moveBScanImageDir(from, to)
  repositories.bScan.changeBarcode(from, to)
  repositories.bScanImages.changeBarcode(from, to, oldDir, newDir)

  return { ok: true, barcode: to }
}

/**
 * 上传 B超记录到服务器。
 * content 字段与旧实现保持一致（后端接口不可修改）。
 */
export async function uploadBScanByBarcode(input: BScanUploadInput): Promise<BScanOperationResult> {
  const barcode = input.barcode
  const record = repositories.bScan.findByBarcode(barcode)
  if (!record) {
    return { ok: false, barcode, message: '记录不存在' }
  }

  const images = await hydrateBScanImages(repositories.bScanImages.listByBarcode(barcode))
  const checked = images.filter((image) => image.isCheck === 'Y')
  const selected = (checked.length ? checked : images).slice(0, 4)

  const content: Record<string, unknown> = {
    ...record,
    bodyParts: record.bodyParts ?? '2',
    isManualResult: 'Y',
    codeBar: record.barcode,
    collectTime: formatDateTime()
  }
  delete content.images

  selected.forEach((image, index) => {
    content[`pic${index + 1}Str`] = (image.base64Path ?? '').replace('data:image/jpeg;base64,', '')
  })
  if (input.reportImageBase64) {
    content.otherReportStr = input.reportImageBase64.replace('data:image/jpeg;base64,', '')
  }

  const result = await uploadBScan(content)
  if (result.ok) {
    repositories.bScan.markUploaded(barcode, 'Y')
    // 仅选中的（最多 4 张）会上传服务器，标记其上传状态；其余保持仅本地
    repositories.bScanImages.markUploaded(selected.map((image) => image.id ?? '').filter(Boolean))
  } else {
    logger.warn(`[bscan] upload failed for ${barcode}: ${result.message}`)
  }
  return { ok: result.ok, barcode, message: result.message }
}

/** 查询模板 */
export function listBScanTemplates(dataType?: string, keyword?: string): BScanTemplate[] {
  return repositories.bScanTemplate.list(dataType, keyword)
}

/** 新增/修改模板或类型 */
export function saveBScanTemplate(template: BScanTemplate): BScanOperationResult {
  if (!template?.id) {
    return { ok: false, message: '缺少模板 ID' }
  }
  maintenance.assertWritable()
  repositories.bScanTemplate.upsert(template)
  return { ok: true }
}

/** 删除模板或类型 */
export function deleteBScanTemplate(id: string): BScanOperationResult {
  if (!id) {
    return { ok: false, message: '缺少模板 ID' }
  }
  maintenance.assertWritable()
  repositories.bScanTemplate.delete(id)
  return { ok: true }
}

/** 从服务器获取公共模板并覆盖本地（原有公共模板会被清空） */
export async function syncPublicBScanTemplates(): Promise<BScanOperationResult> {
  maintenance.assertWritable()
  const list = await fetchPublicTemplates()
  if (!list.length) {
    return { ok: false, message: '未获取到公共模板' }
  }
  repositories.bScanTemplate.deletePublic()
  repositories.bScanTemplate.upsertMany(
    list.filter((item) => item && item.id).map((item) => ({ ...item, isPublic: true }))
  )
  return { ok: true }
}
