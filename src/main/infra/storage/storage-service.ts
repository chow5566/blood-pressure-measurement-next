import { join } from 'node:path'
import fs from 'fs-extra'
import { getDataDir } from '../../config'
import {
  SPACE_THRESHOLD,
  type StorageInfo,
  type StorageValidateResult
} from '../../../shared/domain/storage'
import { formatBytes } from '../../../shared/utils/format'
import { getDriveInfo, getFolderSize, isDirectoryEmpty, isDirectoryWritable } from './disk'
import { DATA_SUB_DIRS, isInside } from './storage-paths'

/**
 * 存储服务：负责数据目录的布局、信息查询与目标目录校验。
 * 实际的迁移动作见 migration-service.ts。
 */

/** 确保数据目录及其子目录存在 */
export function ensureDataLayout(dataDir: string): void {
  for (const sub of DATA_SUB_DIRS) {
    fs.ensureDirSync(join(dataDir, sub))
  }
}

/** 查询当前存储信息（供设置页展示） */
export async function getStorageInfo(): Promise<StorageInfo> {
  const dataDir = getDataDir()
  const exists = await fs.pathExists(dataDir)
  const [usedBytes, drive] = await Promise.all([
    exists ? getFolderSize(dataDir) : Promise.resolve(0),
    getDriveInfo(dataDir)
  ])
  return { dataDir, exists, usedBytes, drive }
}

/**
 * 校验目标数据目录是否可用于迁移。
 * 规则（docs/10-storage-and-migration.md §6/§7）：
 * 1. 合法绝对路径，且不等于当前目录、不互相包含；
 * 2. 仅允许本地固定磁盘（禁止 U盘/移动硬盘/网络盘）；
 * 3. 可创建且可写；
 * 4. 目标目录为空（避免与已有数据混杂）；
 * 5. 剩余空间 ≥ 当前数据量 × 系数 + 额外余量。
 */
export async function validateTargetDir(target: string): Promise<StorageValidateResult> {
  const currentDir = getDataDir()
  const trimmed = (target || '').trim()
  const currentBytes = (await fs.pathExists(currentDir)) ? await getFolderSize(currentDir) : 0
  const requiredBytes =
    Math.ceil(currentBytes * SPACE_THRESHOLD.migrateFactor) + SPACE_THRESHOLD.migrateExtraBytes

  if (!trimmed) {
    return { ok: false, reason: '未选择目标目录', currentBytes, requiredBytes }
  }

  // 互相包含检查
  if (isInside(currentDir, trimmed) || isInside(trimmed, currentDir)) {
    return {
      ok: false,
      reason: '目标目录不能与当前数据目录相同或互相包含',
      currentBytes,
      requiredBytes
    }
  }

  // 磁盘类型检查
  const drive = await getDriveInfo(trimmed)
  if (!drive) {
    return { ok: false, reason: '无法读取目标磁盘信息', drive: null, currentBytes, requiredBytes }
  }
  if (!drive.isLocalDisk) {
    return {
      ok: false,
      reason: '仅支持本地固定磁盘，请勿选择 U盘/移动硬盘/网络盘',
      drive,
      currentBytes,
      requiredBytes
    }
  }

  // 可写检查（会创建目录）
  if (!(await isDirectoryWritable(trimmed))) {
    return { ok: false, reason: '目标目录不可写', drive, currentBytes, requiredBytes }
  }

  // 空目录检查
  if (!(await isDirectoryEmpty(trimmed))) {
    return {
      ok: false,
      reason: '目标目录非空，请选择空文件夹或新建文件夹',
      drive,
      currentBytes,
      requiredBytes
    }
  }

  // 空间检查
  if (drive.freeBytes < requiredBytes) {
    return {
      ok: false,
      reason: `目标磁盘空间不足（需要约 ${formatBytes(requiredBytes)}，可用 ${formatBytes(drive.freeBytes)}）`,
      drive,
      currentBytes,
      requiredBytes
    }
  }

  return { ok: true, drive, currentBytes, requiredBytes }
}

/** 供外部使用的字节格式化（统一实现于 shared/utils/format） */
export { formatBytes }

/** 空间检查结果 */
export interface SpaceCheckResult {
  level: 'ok' | 'warn' | 'block'
  freeBytes: number
  thresholdBytes: number
}

/**
 * 检查数据目录所在磁盘空间。
 * - `block`：低于硬阈值，禁止新写入（避免写坏 DB）
 * - `warn`：低空间预警
 */
export async function checkDataSpace(): Promise<SpaceCheckResult> {
  const drive = await getDriveInfo(getDataDir())
  const freeBytes = drive?.freeBytes ?? Number.POSITIVE_INFINITY
  if (freeBytes < SPACE_THRESHOLD.blockBytes) {
    return { level: 'block', freeBytes, thresholdBytes: SPACE_THRESHOLD.blockBytes }
  }
  if (freeBytes < SPACE_THRESHOLD.warnBytes) {
    return { level: 'warn', freeBytes, thresholdBytes: SPACE_THRESHOLD.warnBytes }
  }
  return { level: 'ok', freeBytes, thresholdBytes: SPACE_THRESHOLD.warnBytes }
}

/** 写入前断言有足够空间；空间过低时抛错（由业务层阻止写入） */
export async function assertSpaceForWrite(): Promise<void> {
  const check = await checkDataSpace()
  if (check.level === 'block') {
    throw new Error(`磁盘空间不足（剩余 ${formatBytes(check.freeBytes)}），请更换存储位置后再试`)
  }
}
