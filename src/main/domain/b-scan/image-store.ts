import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import fs from 'fs-extra'
import { getDataDir } from '../../config'
import { imagesDirOfBarcode } from '../../infra/storage/storage-paths'
import { logger } from '../../infra/logger'
import type { BScanImage } from '../../../shared/domain/b-scan'

/**
 * B超图片落盘与读取。
 * 布局：<dataDir>/images/<barcode>/<uuid>.<ext>
 * 数据库只保存 localPath；base64 仅运行时使用（ADR-012 D4）。
 */

interface ParsedDataURL {
  mime: string
  extension: string
  base64: string
}

/** 解析 dataURL */
function parseDataURL(dataURL: string): ParsedDataURL | null {
  const match = /^data:image\/([a-zA-Z+]+);base64,(.+)$/.exec(dataURL)
  if (!match) return null
  const subtype = match[1].toLowerCase()
  const extension = subtype === 'jpeg' ? 'jpg' : subtype.replace('svg+xml', 'svg')
  return { mime: `image/${subtype}`, extension, base64: match[2] }
}

/**
 * 将图片集合中的 base64 落盘，返回带 localPath 的新数组。
 * 已有 localPath 的图片保持不变（避免重复写盘）。
 */
export async function persistBScanImages(
  barcode: string,
  images: BScanImage[]
): Promise<BScanImage[]> {
  const dir = imagesDirOfBarcode(getDataDir(), barcode)
  await fs.ensureDir(dir)

  const result: BScanImage[] = []
  for (const image of images) {
    if (image.localPath && (await fs.pathExists(image.localPath))) {
      result.push(image)
      continue
    }
    if (!image.base64Path) {
      result.push(image)
      continue
    }
    const parsed = parseDataURL(image.base64Path)
    if (!parsed) {
      logger.warn(`[bscan] invalid image dataURL for ${barcode}`)
      result.push(image)
      continue
    }
    const file = join(dir, `${image.id || randomUUID()}.${parsed.extension}`)
    await fs.writeFile(file, Buffer.from(parsed.base64, 'base64'))
    result.push({ ...image, localPath: file })
  }
  return result
}

/** 读取本地图片为 base64（用于预览/报告） */
export async function hydrateBScanImages(images: BScanImage[]): Promise<BScanImage[]> {
  const result: BScanImage[] = []
  for (const image of images) {
    if (image.localPath && !image.base64Path) {
      try {
        const buffer = await fs.readFile(image.localPath)
        const ext = (image.localPath.split('.').pop() || 'jpg').toLowerCase()
        // 统一 MIME：jpg/jpeg → jpeg（docxtemplater 图片模块按 MIME 推断扩展名）
        const mime = ext === 'png' ? 'png' : ext === 'gif' ? 'gif' : 'jpeg'
        result.push({
          ...image,
          base64Path: `data:image/${mime};base64,${buffer.toString('base64')}`
        })
        continue
      } catch (error) {
        logger.warn(`[bscan] read image failed: ${(error as Error).message}`)
      }
    }
    result.push(image)
  }
  return result
}

/** 删除某条码下的图片文件目录 */
export async function removeBScanImageDir(barcode: string): Promise<void> {
  const dir = imagesDirOfBarcode(getDataDir(), barcode)
  await fs.remove(dir).catch(() => undefined)
}

/** 条码变更时迁移图片目录 */
export async function moveBScanImageDir(oldBarcode: string, newBarcode: string): Promise<void> {
  const base = getDataDir()
  const from = imagesDirOfBarcode(base, oldBarcode)
  const to = imagesDirOfBarcode(base, newBarcode)
  if (await fs.pathExists(from)) {
    await fs.move(from, to, { overwrite: true })
  }
}
