import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { logger } from '../../logger'
import { resourcePath } from '../../../utils/resource'
import type { DriverStatus } from '../../../../shared/domain/app'

const execFileAsync = promisify(execFile)

/**
 * 设备驱动安装（VGA2USB / Epiphan）。
 * 通过 msiexec 静默安装/卸载；按操作系统位数选择 x86/x64 安装包。
 *
 * 注意：`resources/drivers` 中当前为占位文件，交付前需替换为真实 MSI。
 */

/** 驱动名 → 安装包相对路径（按位数） */
const DRIVER_FILES: Record<string, { x64: string; x86: string }> = {
  VGA2USB: {
    x64: 'drivers/vga2usb/V2UInstaller64.msi',
    x86: 'drivers/vga2usb/V2UInstaller32.msi'
  }
}

/** 设备管理器中用于识别已安装驱动的名称关键字 */
const DRIVER_DEVICE_KEYWORD: Record<string, string> = {
  VGA2USB: 'VGA2USB'
}

/** 当前系统位数 */
export function getOsArch(): 'x86' | 'x64' {
  return process.arch === 'x64' ? 'x64' : 'x86'
}

/** 解析安装包路径 */
function resolveInstaller(name: string): string {
  const entry = DRIVER_FILES[name]
  if (!entry) throw new Error(`未配置的驱动：${name}`)
  const relative = getOsArch() === 'x64' ? entry.x64 : entry.x86
  return resourcePath(relative)
}

/** 检查驱动是否已安装（设备管理器，失败按未安装处理） */
export async function checkDriverInstalled(name: string): Promise<DriverStatus> {
  const keyword = DRIVER_DEVICE_KEYWORD[name] ?? name
  const osArch = getOsArch()
  try {
    const script =
      `Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | ` +
      `Where-Object { $_.FriendlyName -like '*${keyword}*' } | ` +
      `Select-Object -First 1 -ExpandProperty FriendlyName`
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 15000 }
    )
    return { name, installed: stdout.trim().length > 0, osArch }
  } catch (error) {
    logger.warn(`[driver] check failed: ${(error as Error).message}`)
    return { name, installed: false, osArch }
  }
}

/** 安装驱动（msiexec 静默） */
export async function installDriver(name: string): Promise<DriverStatus> {
  const installer = resolveInstaller(name)
  if (!existsSync(installer)) {
    const arch = getOsArch()
    logger.error(`[driver] installer missing (${arch}): ${installer}`)
    throw new Error(
      `缺少 ${arch} 驱动安装包：${installer}\n请在 resources/drivers/vga2usb 目录放置对应安装包后重试`
    )
  }
  logger.info(`[driver] installing ${name} from ${installer}`)
  try {
    await execFileAsync('msiexec', ['/i', installer, '/qn', '/norestart'], {
      windowsHide: true,
      timeout: 5 * 60 * 1000
    })
  } catch (error) {
    throw new Error(`驱动安装失败：${(error as Error).message}`)
  }
  return checkDriverInstalled(name)
}

/** 卸载驱动（msiexec 静默） */
export async function uninstallDriver(name: string): Promise<DriverStatus> {
  const installer = resolveInstaller(name)
  if (!existsSync(installer)) {
    const arch = getOsArch()
    throw new Error(`缺少 ${arch} 驱动安装包：${installer}\n无法执行卸载，请确认安装包存在`)
  }
  try {
    await execFileAsync('msiexec', ['/x', installer, '/qn', '/norestart'], {
      windowsHide: true,
      timeout: 5 * 60 * 1000
    })
  } catch (error) {
    throw new Error(`驱动卸载失败：${(error as Error).message}`)
  }
  return checkDriverInstalled(name)
}
