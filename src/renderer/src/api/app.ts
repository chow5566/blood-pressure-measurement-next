import type { AppInfo } from '@shared/ipc'

/** 应用级 API 封装（渲染进程统一通过此处调用，避免散落字符串通道） */
export const appApi = {
  info: (): Promise<AppInfo> => window.api.invoke('app:info'),
  ping: (message: string): Promise<string> => window.api.invoke('app:ping', message),
  openExternal: (url: string): Promise<void> => window.api.invoke('app:open-external', url)
}
