import { handle } from '../registry'
import { getAuthPopup, getCaptcha, login, logout } from '../../domain/auth/service'

/** 登录 IPC */
export function registerAuthIpc(): void {
  handle('auth:login', (_event, input) => login(input))
  handle('auth:captcha', (_event, uuid) => getCaptcha(uuid))
  handle('auth:auth-popup', (_event, orgCode) => getAuthPopup(orgCode))
  handle('auth:logout', () => logout())
}
