import axios from 'axios'
import { logger } from '../../infra/logger'
import { httpGet, httpPost, type ApiResponse } from '../../infra/http/client'
import { getBaseApi, setToken, setUsername } from '../../config'
import { encryptPassword } from './crypto'
import type { AuthPopupInfo, LoginInput, LoginResult } from '../../../shared/domain/app'

/**
 * 登录/用户信息服务。
 * 契约与旧项目一致：
 * - GET  `/captcha.jpg?uuid=xxx` → 图形验证码（jpeg）
 * - POST `/sys/login` { username, password(加密), captcha, uuid } → { code:0, token }
 * - GET  `/sys/user/info` → { code:0, user }
 * - POST `/bs/authOrgConfig/popups` { orgCode } → 授权提示（可选）
 */

interface LoginResponse extends ApiResponse {
  code?: number
  msg?: string
  token?: string
  user?: Record<string, unknown>
}

interface InfoResponse extends ApiResponse {
  code?: number
  msg?: string
  user?: Record<string, unknown>
}

/** 登录 */
export async function login(input: LoginInput): Promise<LoginResult> {
  const username = input.username?.trim()
  if (!username || !input.password) {
    return { ok: false, message: '请输入账号和密码' }
  }

  try {
    const encrypted = encryptPassword(input.password, getBaseApi())
    const body: Record<string, unknown> = { username, password: encrypted }
    if (input.captcha) body.captcha = input.captcha.trim()
    if (input.uuid) body.uuid = input.uuid
    const res = await httpPost<LoginResponse>('/sys/login', body, false)
    if (res.code !== 0 || !res.token) {
      return { ok: false, message: res.msg || '登录失败' }
    }

    setToken(res.token)
    setUsername(username)

    // 拉取用户信息（失败不阻塞登录，保持 token 有效）
    let user: Record<string, unknown> = {}
    try {
      const info = await getInfo()
      user = info ?? {}
    } catch (error) {
      logger.warn('[auth] fetch user info failed', error)
    }

    return { ok: true, username, user }
  } catch (error) {
    const raw = (error as Error).message || '网络异常'
    const message = /timeout|ETIMEDOUT|ECONNABORTED/i.test(raw)
      ? `连接服务器超时，请检查服务地址或网络（${raw}）`
      : /ENOTFOUND|ECONNREFUSED|EHOSTUNREACH/i.test(raw)
        ? `无法连接服务器，请检查服务地址或网络（${raw}）`
        : raw
    logger.warn(`[auth] login failed: ${raw}`)
    return { ok: false, message }
  }
}

/** 获取图形验证码（返回 dataURL，供渲染层直接展示；失败返回空串） */
export async function getCaptcha(uuid: string): Promise<string> {
  try {
    const response = await axios.get('/captcha.jpg', {
      baseURL: getBaseApi(),
      params: { uuid },
      responseType: 'arraybuffer',
      timeout: 15000
    })
    const mime = String(response.headers['content-type'] || 'image/jpeg').split(';')[0]
    const base64 = Buffer.from(response.data as ArrayBuffer).toString('base64')
    return `data:${mime};base64,${base64}`
  } catch (error) {
    logger.warn(`[auth] captcha fetch failed: ${(error as Error).message}`)
    return ''
  }
}

/** 获取当前用户信息 */
export async function getInfo(): Promise<Record<string, unknown> | null> {
  const res = await httpGet<InfoResponse>('/sys/user/info')
  if (res.code !== 0) return null
  return res.user ?? null
}

/** 退出登录（清除 token） */
export function logout(): void {
  setToken('')
  setUsername('')
}

/** 机构授权弹窗信息（可能不存在，返回 null 表示无需提示） */
export async function getAuthPopup(orgCode?: string): Promise<AuthPopupInfo | null> {
  if (!orgCode) return null
  try {
    const res = await httpPost<ApiResponse & { authOrgConfigEntity?: AuthPopupInfo }>(
      '/bs/authOrgConfig/popups',
      { orgCode }
    )
    return res.authOrgConfigEntity ?? null
  } catch {
    return null
  }
}
