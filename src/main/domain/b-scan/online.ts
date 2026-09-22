import axios from 'axios'
import { getStaticApi } from '../../config'
import { logger } from '../../infra/logger'
import { httpGet, type ApiResponse } from '../../infra/http/client'
import type {
  BScanCheckType,
  BScanImage,
  BScanTemplate,
  OnlineBScanData
} from '../../../shared/domain/b-scan'

/**
 * B超在线数据查询（需要登录 token）。
 * 接口契约沿用旧项目，不可修改：
 * - GET  /gbuserhealth/getDetail?checkupNo=         公卫：居民/体检信息
 * - GET  /gbuserhealth/info?checkId&userId&type     公卫：健康数据（含 bScan）
 * - GET  /business/checkup/getCheckupByCode?codeBar 商业：体检信息（bsMap）
 */

/** 下载图片为 dataURL */
async function downloadImageAsDataUrl(uploadUrl: string): Promise<string> {
  const url = /^https?:\/\//.test(uploadUrl)
    ? uploadUrl
    : `${getStaticApi().replace(/\/$/, '')}/${uploadUrl.replace(/^\//, '')}`
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 })
    const contentType = String(response.headers['content-type'] || 'image/jpeg').split(';')[0]
    const base64 = Buffer.from(response.data as ArrayBuffer).toString('base64')
    return `data:${contentType};base64,${base64}`
  } catch (error) {
    logger.warn(`[bscan] download image failed: ${url} ${(error as Error).message}`)
    return ''
  }
}

/** 公卫：按条码查询 */
async function lookupGw(barcode: string): Promise<OnlineBScanData | null> {
  type DetailResponse = ApiResponse & {
    detail?: {
      checkup?: { id?: string | number }
      userInfo?: {
        id?: string | number
        name?: string
        idCard?: string
        birthday?: string
        gender?: string | number
      }
    }
  }
  const detailRes = await httpGet<DetailResponse>('/gbuserhealth/getDetail', { checkupNo: barcode })
  const detail = detailRes.detail
  if (!detail) return null

  const userInfo = detail.userInfo ?? {}
  let bScan: {
    diagnosis?: string
    diagnosisDetails?: string
    localRemark?: string
    imageList?: string[]
  } = {}
  try {
    type HealthResponse = ApiResponse & {
      userHealth?: { bScan?: typeof bScan }
    }
    const healthRes = await httpGet<HealthResponse>('/gbuserhealth/info', {
      checkId: detail.checkup?.id,
      userId: userInfo.id,
      type: 'bScan'
    })
    bScan = healthRes.userHealth?.bScan ?? {}
  } catch (error) {
    logger.warn('[bscan] gw health info failed', error)
  }

  const images: BScanImage[] = []
  for (const uploadUrl of bScan.imageList ?? []) {
    if (!uploadUrl) continue
    images.push({
      id: `online-${images.length}-${Date.now()}`,
      uploadUrl,
      isUpload: 'Y',
      isCheck: images.length === 0 ? 'Y' : 'N',
      base64Path: await downloadImageAsDataUrl(uploadUrl)
    })
  }

  return {
    name: userInfo.name ?? '',
    idCard: userInfo.idCard ?? '',
    birthday: userInfo.birthday ?? '',
    gender: userInfo.gender !== undefined ? String(userInfo.gender) : '',
    diagnosis: bScan.diagnosis ?? '',
    diagnosisDetails: bScan.diagnosisDetails ?? '',
    localRemark: bScan.localRemark ?? '',
    images
  }
}

/** 商业：按条码查询 */
async function lookupBs(barcode: string): Promise<OnlineBScanData | null> {
  type CheckupResponse = ApiResponse & {
    checkup?: {
      gbUserInfoEntity?: {
        name?: string
        idCard?: string
        birthday?: string
        gender?: string | number
      }
      bsMap?: Record<string, string>
    }
  }
  const res = await httpGet<CheckupResponse>('/business/checkup/getCheckupByCode', {
    codeBar: barcode
  })
  const info = res.checkup
  if (!info) return null

  const user = info.gbUserInfoEntity ?? {}
  const bsMap = info.bsMap ?? {}
  const imageUrls = ['BSCAN_PIC1', 'BSCAN_PIC2', 'BSCAN_PIC3', 'BSCAN_PIC4']
    .map((key) => bsMap[key])
    .filter(Boolean)

  const images: BScanImage[] = []
  for (const uploadUrl of imageUrls) {
    images.push({
      id: `online-${images.length}-${Date.now()}`,
      uploadUrl,
      isUpload: 'Y',
      isCheck: images.length === 0 ? 'Y' : 'N',
      base64Path: await downloadImageAsDataUrl(uploadUrl)
    })
  }

  return {
    name: user.name ?? '',
    idCard: user.idCard ?? '',
    birthday: user.birthday ?? '',
    gender: user.gender !== undefined ? String(user.gender) : '',
    diagnosis: bsMap.BSCAN_RESULT ?? '',
    diagnosisDetails: bsMap.BSCAN_DETAIL ?? '',
    images
  }
}

/** 按类型查询在线数据 */
export function lookupOnlineBScan(
  barcode: string,
  type: BScanCheckType | string = 'GW'
): Promise<OnlineBScanData | null> {
  return type === 'BS' ? lookupBs(barcode) : lookupGw(barcode)
}

/** 获取服务器公共模板列表（GET /cfBscanTemplate/list） */
export async function fetchPublicTemplates(): Promise<BScanTemplate[]> {
  type TemplateResponse = ApiResponse & {
    data?: BScanTemplate[]
    rows?: BScanTemplate[]
  }
  const res = await httpGet<TemplateResponse>('/cfBscanTemplate/list')
  const list = res.data ?? res.rows ?? []
  return Array.isArray(list) ? list : []
}
