import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join, parse } from 'node:path'
import fs from 'fs-extra'
import { DriveType, type DriveInfo } from '../../../shared/domain/storage'

const execFileAsync = promisify(execFile)

/**
 * 磁盘与目录信息工具。
 *
 * Win7 兼容性：不使用 Node 18+ 的 `fs.statfs`（Electron 22 为 Node 16），
 * 而是通过 PowerShell `Get-WmiObject Win32_LogicalDisk` 查询，wmic 作为兜底。
 * 目录/文件操作使用 fs-extra。
 */

/** 从任意路径解析盘符，如 'C:'；无法解析返回空串 */
export function getDriveLetter(target: string): string {
  try {
    return parse(target).root.replace(/[\\/]+$/, '')
  } catch {
    return ''
  }
}

/** 数字安全转换 */
function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * 查询目标路径所在磁盘的信息。
 * @returns 查询失败返回 null（调用方需处理，不可据此判定磁盘不可用）
 */
export async function getDriveInfo(target: string): Promise<DriveInfo | null> {
  const drive = getDriveLetter(target)
  if (!drive || process.platform !== 'win32') return null

  const raw = await queryWindowsDrive(drive)
  if (!raw) return null

  const driveType = toNumber(raw.DriveType) as DriveType
  return {
    drive,
    totalBytes: toNumber(raw.Size),
    freeBytes: toNumber(raw.FreeSpace),
    driveType,
    isLocalDisk: driveType === DriveType.Fixed
  }
}

interface RawDrive {
  Size?: unknown
  FreeSpace?: unknown
  DriveType?: unknown
}

/** 依次尝试 PowerShell 与 wmic 获取逻辑盘信息 */
async function queryWindowsDrive(drive: string): Promise<RawDrive | null> {
  // 方式一：PowerShell（Get-WmiObject 兼容 Win7 的 PowerShell 2.0+）
  try {
    const script =
      `Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='${drive}'" ` +
      `| Select-Object Size,FreeSpace,DriveType | ConvertTo-Json -Compress`
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 15000 }
    )
    const text = stdout.trim()
    if (text) {
      const parsed = JSON.parse(text) as RawDrive | RawDrive[]
      return Array.isArray(parsed) ? (parsed[0] ?? null) : parsed
    }
  } catch {
    // 忽略，尝试下一种方式
  }

  // 方式二：wmic（Win7/Win10 可用；Win11 24H2 起可能移除）
  try {
    const { stdout } = await execFileAsync(
      'wmic',
      [
        'logicaldisk',
        'where',
        `"DeviceID='${drive}'"`,
        'get',
        'Size,FreeSpace,DriveType',
        '/format:csv'
      ],
      { windowsHide: true, timeout: 15000 }
    )
    const line = stdout
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => item && !item.startsWith('Node'))
      .pop()
    if (!line) return null
    // CSV 列顺序：Node,DeviceID,DriveType,FreeSpace,Size（按字母序）
    const parts = line.split(',')
    return { DriveType: parts[2], FreeSpace: parts[3], Size: parts[4] }
  } catch {
    return null
  }
}

/** 递归计算目录占用（字节）；目录不存在返回 0 */
export async function getFolderSize(dir: string): Promise<number> {
  let total = 0
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      total += await getFolderSize(fullPath)
    } else if (entry.isFile()) {
      try {
        total += (await fs.stat(fullPath)).size
      } catch {
        // 单文件失败不影响整体（例如临时文件被占用）
      }
    }
  }
  return total
}

/** 目录是否为空（不存在视为空） */
export async function isDirectoryEmpty(dir: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dir)
    return entries.length === 0
  } catch {
    return true
  }
}

/** 测试目录是否可写（写入并删除一个临时文件） */
export async function isDirectoryWritable(dir: string): Promise<boolean> {
  const probe = join(dir, `.write-test-${Date.now()}.tmp`)
  try {
    await fs.ensureDir(dir)
    await fs.writeFile(probe, 'ok')
    await fs.remove(probe)
    return true
  } catch {
    return false
  }
}
