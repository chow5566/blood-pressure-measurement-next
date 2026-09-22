import type { AuthPopupInfo, LoginInput, LoginResult } from '@shared/domain/app'

/** 登录 API */
export const authApi = {
  login: (input: LoginInput): Promise<LoginResult> => window.api.invoke('auth:login', input),
  captcha: (uuid: string): Promise<string> => window.api.invoke('auth:captcha', uuid),
  authPopup: (orgCode?: string): Promise<AuthPopupInfo | null> =>
    window.api.invoke('auth:auth-popup', orgCode),
  logout: (): Promise<void> => window.api.invoke('auth:logout')
}
