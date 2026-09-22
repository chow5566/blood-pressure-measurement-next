import axios from 'axios'
import { getBaseApi, getToken } from '../../config'
import { logger } from '../logger'
import { encode64 } from '../../../shared/utils/encode'

/**
 * 服务端上传客户端（主进程侧）。
 *
 * 后端接口不可修改，契约沿用旧实现：
 * - POST `{baseApi}/healthdata/single/upload/data`
 * - header 携带 `token`
 * - body：`{ dataType, dataContent }`，其中 dataContent 为 JSON 的 UTF-8 Base64
 * - 成功判定：响应 `code === 0`（旧实现）
 */

export interface UploadResult {
  ok: boolean
  message?: string
}

/** 创建 axios 实例（超时与旧项目一致，量级更长以适配弱网） */
const http = axios.create({ timeout: 60 * 1000 })

/**
 * 通用健康数据上传。
 * @param dataType 'BP' | 'BSCAN'
 * @param dataContent 业务对象（内部 JSON 序列化 + Base64）
 */
export async function uploadHealthData(
  dataType: string,
  dataContent: Record<string, unknown>
): Promise<UploadResult> {
  const baseURL = getBaseApi()
  const token = getToken()

  if (!token) {
    return { ok: false, message: '未登录，已保存到本地' }
  }

  try {
    const response = await http.post(
      '/healthdata/single/upload/data',
      { dataType, dataContent: encode64(JSON.stringify(dataContent)) },
      { baseURL, headers: { token } }
    )
    const code = response.data?.code
    if (code === 0 || code === 200) {
      return { ok: true }
    }
    return { ok: false, message: response.data?.msg || '上传失败' }
  } catch (error) {
    const message = (error as Error).message
    logger.warn(`[http] upload ${dataType} failed: ${message}`)
    return { ok: false, message: message || '网络异常' }
  }
}

/** 上传血压数据 */
export function uploadBloodPressure(dataContent: Record<string, unknown>): Promise<UploadResult> {
  return uploadHealthData('BP', dataContent)
}

/** 上传 B超数据 */
export function uploadBScan(dataContent: Record<string, unknown>): Promise<UploadResult> {
  return uploadHealthData('BSCAN', dataContent)
}
