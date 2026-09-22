import { join } from 'node:path'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'

/**
 * 打包资源路径解析。
 * - 开发：<项目根>/resources/...
 * - 打包：<resources>/resources/...（extraResources 配置）
 */
export function resourcePath(...segments: string[]): string {
  const base = is.dev ? app.getAppPath() : process.resourcesPath
  return join(base, 'resources', ...segments)
}
