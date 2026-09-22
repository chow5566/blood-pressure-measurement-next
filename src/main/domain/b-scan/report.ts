import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { app, nativeImage } from 'electron'
import { is } from '@electron-toolkit/utils'
import axios from 'axios'
import Docxtemplater from 'docxtemplater'
import ImageModule from 'docxtemplater-image-module-free'
import PizZip from 'pizzip'
import sizeOf from 'image-size'
import { formatDateTime } from '../../../shared/utils/format'
import { logger } from '../../infra/logger'
import type { BScanReportParams } from '../../../shared/domain/b-scan'

/**
 * B超报告生成（docxtemplater 套用 Word 模板）。
 * 模板：resources/template/bscan-default.docx
 * 输出：docx 的 dataURL（base64），交由渲染进程用 docx-preview 转图片预览。
 */

/** 默认报告模板名 */
const DEFAULT_TEMPLATE = 'bscan-default.docx'

/**
 * 解析模板文件绝对路径。
 * - 开发：<项目根>/resources/template
 * - 打包：<resources>/resources/template（extraResources 配置）
 */
export function resolveTemplateFile(name: string = DEFAULT_TEMPLATE): string {
  const base = is.dev ? app.getAppPath() : process.resourcesPath
  return join(base, 'resources', 'template', name)
}

/** base64 dataURL → ArrayBuffer（docxtemplater 图片模块需要） */
function base64DataURLToArrayBuffer(dataURL: string): ArrayBuffer | false {
  const regex = /^data:image\/(png|jpg|jpeg|svg|svg\+xml);base64,/
  if (!regex.test(dataURL)) return false
  const base64 = dataURL.replace(regex, '')
  const bytes = Buffer.from(base64, 'base64')
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

/** 解析图片来源：dataURL 直接转换；http(s) 地址下载后转换；统一转 PNG */
async function resolveImage(value: string): Promise<ArrayBuffer | false> {
  let buffer: Buffer | null = null

  if (value.startsWith('data:image/')) {
    const arrayBuffer = base64DataURLToArrayBuffer(value)
    if (!arrayBuffer) return false
    buffer = Buffer.from(arrayBuffer)
  } else if (/^https?:\/\//i.test(value)) {
    try {
      const response = await axios.get(value, { responseType: 'arraybuffer', timeout: 30000 })
      buffer = Buffer.from(response.data as ArrayBuffer)
    } catch (error) {
      logger.warn(`[bscan] report image download failed: ${value} ${(error as Error).message}`)
      return false
    }
  }

  if (!buffer) return false

  // docxtemplater-image-module-free 固定以 .png 写入，需保证字节为 PNG
  const isPng = buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50
  if (!isPng) {
    const png = nativeImage.createFromBuffer(buffer).toPNG()
    if (png && png.length) buffer = png
  }
  const finalPng = buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50
  logger.info(`[bscan] report image resolved: ${buffer.length} bytes png=${finalPng}`)
  return new Uint8Array(buffer).buffer
}

/** 生成 B超报告，返回 docx 的 dataURL */
export async function generateBScanReport(params: BScanReportParams): Promise<string> {
  if (!params) {
    throw new Error('缺少报告参数')
  }

  const templatePath = resolveTemplateFile()
  const content = await readFile(templatePath)
  const zip = new PizZip(content)

  // 收集图片（支持 dataURL 与 http(s) 地址）
  const imageDict: Record<string, ArrayBuffer | false> = {}
  const imageKeys = ['image1', 'image2', 'image3', 'image4'] as const
  for (const key of imageKeys) {
    const value = params[key]
    if (value) {
      imageDict[key] = await resolveImage(value)
    }
  }
  logger.info(
    `[bscan] report images: ${imageKeys
      .map((key) => `${key}:${imageDict[key] ? 'ok' : '-'}`)
      .join(' ')}`
  )

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    modules: [
      new ImageModule({
        getImage: (_value: string, key: string) => imageDict[key],
        getSize: (afterValue: ArrayBuffer) => {
          const buffer = Buffer.from(afterValue)
          const dimensions = sizeOf(buffer)
          const docWidth = 800 // dpi 96 时文档宽度约 800px
          const imgWidth = docWidth * 0.3
          const aspectRatio = (dimensions?.height ?? 1) / (dimensions?.width ?? 1)
          return [imgWidth, imgWidth * aspectRatio]
        }
      })
    ]
  })

  const renderData: Record<string, string> = {
    title: params.title ?? '',
    barcode: params.barcode ?? '',
    name: params.name ?? '',
    gender: params.gender ?? '',
    age: params.age ?? '',
    diagnosis: params.diagnosis ?? '',
    diagnosisDetails: params.diagnosisDetails ?? '',
    doctorName: params.doctorName ?? '',
    createTime: params.createTime
      ? formatDateTime(new Date(String(params.createTime).replace(/-/g, '/')))
      : formatDateTime()
  }
  for (const key of imageKeys) {
    if (imageDict[key]) renderData[key] = key
  }

  doc.render(renderData)

  const docBase64 = doc.getZip().generate({ type: 'base64', compression: 'DEFLATE' })
  return `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docBase64}`
}
