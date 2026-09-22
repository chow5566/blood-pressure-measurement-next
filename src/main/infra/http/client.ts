import axios, { type AxiosRequestConfig } from 'axios'
import { getBaseApi, getToken, setToken } from '../../config'

/**
 * 主进程 HTTP 客户端（服务端接口不可修改，契约沿用旧项目）。
 * 约定：响应体形如 `{ code, msg, token, user, ... }`，`code === 0` 表示业务成功。
 *
 * 超时设为 15s：登录/查询类请求需要快速失败并给出明确提示（避免长时间转圈）。
 * 大文件上传使用独立的 uploader（更长超时）。
 */
const http = axios.create({ timeout: 15000 })

// 401 统一处理：清除本地 token，并给出可读错误（由 UI 引导重新登录）
http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    if (status === 401) {
      setToken('')
      return Promise.reject(new Error('登录已失效，请重新登录'))
    }
    return Promise.reject(error)
  }
)

/** 服务端统一响应体 */
export interface ApiResponse<T = Record<string, unknown>> {
  code?: number
  msg?: string
  [key: string]: T[keyof T] | unknown
}

function buildConfig(withToken: boolean): AxiosRequestConfig {
  const config: AxiosRequestConfig = { baseURL: getBaseApi() }
  if (withToken) {
    config.headers = { token: getToken() }
  }
  return config
}

/** GET */
export async function httpGet<T = ApiResponse>(
  path: string,
  params?: Record<string, unknown>,
  withToken = true
): Promise<T> {
  const response = await http.get(path, { ...buildConfig(withToken), params })
  return response.data as T
}

/** POST */
export async function httpPost<T = ApiResponse>(
  path: string,
  data?: Record<string, unknown>,
  withToken = true
): Promise<T> {
  const response = await http.post(path, data, buildConfig(withToken))
  return response.data as T
}
