import { app } from 'electron'
import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import fs from 'fs-extra'
import { logger } from '../logger'
import { maintenance } from '../maintenance'
import { getDataDir, setDataDir } from '../../config'
import { initDatabase, resolveDatabaseFile, shutdownDatabase } from '../database'
import { timestampFragment } from '../../utils/datetime'
import { ensureDataLayout, validateTargetDir } from './storage-service'
import type { MigrateProgress, MigrateResult } from '../../../shared/domain/storage'

/**
 * 数据目录迁移服务。
 *
 * 迁移流程（详见 docs/10-storage-and-migration.md §6）：
 *   precheck → freeze(关闭DB) → copy(复制到目标临时目录)
 *   → verify(文件数/字节数/DB完整性) → switch(改配置指针)
 *   → reopen(新库打开) → cleanup(删除旧数据) → done(自动重启)
 *
 * 安全原则：
 * - 先复制后切换：切换前原数据始终完整；
 * - 校验通过才切换指针；
 * - 删除旧数据前先改名再删，避免半删状态；
 * - 任一步失败：清理临时目录、回滚配置、恢复旧库连接。
 *
 * 文件操作使用 fs-extra（成熟库），复制过程保留逐字节进度回调。
 */

export interface MigrateOptions {
  from: string
  to: string
  /** 进度回调（主进程用它把进度推给渲染进程） */
  onProgress?: (progress: MigrateProgress) => void
}

/** 防止并发迁移 */
let migrating = false

/** 是否正在迁移 */
export function isMigrating(): boolean {
  return migrating
}

/**
 * 执行数据目录迁移。成功后会在短暂延迟后自动重启应用。
 */
export async function migrateDataDir(options: MigrateOptions): Promise<MigrateResult> {
  if (migrating) {
    return { ok: false, message: '已有迁移任务在执行' }
  }

  const from = options.from || getDataDir()
  const to = options.to
  const report = (progress: MigrateProgress): void => options.onProgress?.(progress)
  const staging = join(to, `.migrate-${timestampFragment()}`)

  migrating = true
  let switched = false

  try {
    // ── 预检 ────────────────────────────────────────────────
    report({ phase: 'precheck', percent: 2, copiedBytes: 0, totalBytes: 0 })
    const validation = await validateTargetDir(to)
    if (!validation.ok) {
      throw new Error(validation.reason || '目标目录校验失败')
    }
    const totalBytes = validation.currentBytes ?? 0

    // ── 冻结写入并关闭数据库 ────────────────────────────────
    maintenance.enable('数据迁移中，请勿操作')
    report({ phase: 'freeze', percent: 6, copiedBytes: 0, totalBytes })
    shutdownDatabase()
    logger.info(`[storage] migration start: ${from} -> ${to} (${totalBytes} bytes)`)

    // ── 复制到目标临时目录 ──────────────────────────────────
    await fs.ensureDir(staging)
    let copiedBytes = 0
    await copyDirectory(from, staging, (delta) => {
      copiedBytes += delta
      const ratio = totalBytes > 0 ? Math.min(1, copiedBytes / totalBytes) : 1
      report({
        phase: 'copy',
        percent: 6 + Math.round(ratio * 78),
        copiedBytes,
        totalBytes
      })
    })

    // ── 校验 ────────────────────────────────────────────────
    report({ phase: 'verify', percent: 86, copiedBytes, totalBytes })
    await verifyCopy(from, staging)
    verifyDatabaseIntegrity(resolveDatabaseFile(staging))

    // ── 切换：把临时目录内容移到目标根 ──────────────────────
    await moveChildren(staging, to)
    await fs.remove(staging)

    setDataDir(to)
    switched = true
    report({ phase: 'switch', percent: 92, copiedBytes, totalBytes })
    logger.info(`[storage] dataDir switched to ${to}`)

    // ── 重新打开新库 ────────────────────────────────────────
    ensureDataLayout(to)
    initDatabase(to)
    report({ phase: 'reopen', percent: 95, copiedBytes, totalBytes })

    // ── 删除旧数据（先改名再删） ────────────────────────────
    await removeOldData(from)
    report({ phase: 'done', percent: 100, copiedBytes, totalBytes })
    logger.info('[storage] migration done, relaunching...')

    // 延迟重启，确保 IPC 结果能返回渲染进程
    scheduleRelaunch()
    return { ok: true, from, to }
  } catch (error) {
    const message = (error as Error)?.message || String(error)
    logger.error(`[storage] migration failed: ${message}`)
    report({ phase: 'failed', percent: 0, copiedBytes: 0, totalBytes: 0, message })

    // 回滚：清理临时目录、恢复配置与旧库连接
    await fs.remove(staging).catch(() => undefined)
    if (switched) {
      setDataDir(from)
    }
    try {
      ensureDataLayout(from)
      initDatabase(from)
    } catch (reopenError) {
      logger.error('[storage] reopen old database failed', reopenError)
    }
    maintenance.disable()
    return { ok: false, from, to, message }
  } finally {
    migrating = false
  }
}

/** 递归复制目录，逐文件回调新增字节数；跳过 WAL/SHM 临时文件 */
async function copyDirectory(
  from: string,
  to: string,
  onBytes: (delta: number) => void
): Promise<void> {
  await fs.ensureDir(to)
  const entries = await fs.readdir(from, { withFileTypes: true })
  for (const entry of entries) {
    if (isTransientFile(entry.name)) continue

    const source = join(from, entry.name)
    const target = join(to, entry.name)
    if (entry.isDirectory()) {
      await copyDirectory(source, target, onBytes)
    } else if (entry.isFile()) {
      await fs.copyFile(source, target)
      const stat = await fs.stat(source)
      onBytes(stat.size)
    }
  }
}

/** 校验复制结果：文件数、总字节数、数据库 SHA-256 一致 */
async function verifyCopy(from: string, to: string): Promise<void> {
  const sourceStat = await treeStat(from)
  const targetStat = await treeStat(to)
  if (sourceStat.files !== targetStat.files || sourceStat.bytes !== targetStat.bytes) {
    throw new Error(
      `复制校验失败：源(${sourceStat.files}个/${sourceStat.bytes}字节) ` +
        `目标(${targetStat.files}个/${targetStat.bytes}字节)`
    )
  }

  const sourceDb = resolveDatabaseFile(from)
  const targetDb = resolveDatabaseFile(to)
  if ((await fs.pathExists(sourceDb)) && (await fs.pathExists(targetDb))) {
    const [sourceHash, targetHash] = await Promise.all([hashFile(sourceDb), hashFile(targetDb)])
    if (sourceHash !== targetHash) {
      throw new Error('数据库文件校验失败（SHA-256 不一致）')
    }
  }
}

/** 统计目录文件数与总字节数 */
async function treeStat(dir: string): Promise<{ files: number; bytes: number }> {
  let files = 0
  let bytes = 0
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (isTransientFile(entry.name)) continue
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      const sub = await treeStat(fullPath)
      files += sub.files
      bytes += sub.bytes
    } else if (entry.isFile()) {
      files += 1
      bytes += (await fs.stat(fullPath)).size
    }
  }
  return { files, bytes }
}

/** WAL/SHM 等瞬时文件，不参与复制与统计 */
function isTransientFile(name: string): boolean {
  return /\.(wal|shm)$/i.test(name)
}

/** 计算文件 SHA-256（流式，避免大文件占用内存） */
function hashFile(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(file)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

/** SQLite 完整性检查 */
function verifyDatabaseIntegrity(dbFile: string): void {
  if (!fs.existsSync(dbFile)) return
  const db = new Database(dbFile, { readonly: true, fileMustExist: true })
  try {
    const result = db.pragma('integrity_check', { simple: true })
    if (result !== 'ok') {
      throw new Error(`数据库完整性校验失败：${String(result)}`)
    }
  } finally {
    db.close()
  }
}

/** 将 source 目录下的所有子项移动到 target 根目录（同盘 rename，快速） */
async function moveChildren(source: string, target: string): Promise<void> {
  const entries = await fs.readdir(source)
  for (const name of entries) {
    const src = join(source, name)
    const dest = join(target, name)
    // 目标若已存在（校验已保证为空）则先删除
    await fs.remove(dest)
    await fs.rename(src, dest)
  }
}

/** 删除旧数据目录：先改名再删除，失败不阻塞（数据已在新目录） */
async function removeOldData(oldDir: string): Promise<void> {
  if (!(await fs.pathExists(oldDir))) return
  const tombstone = `${oldDir}.deleting-${timestampFragment()}`
  try {
    await fs.rename(oldDir, tombstone)
  } catch (error) {
    logger.warn(`[storage] rename old data failed, try direct remove: ${(error as Error).message}`)
    await fs
      .remove(oldDir)
      .catch((e) => logger.warn(`[storage] remove old data failed: ${e.message}`))
    return
  }
  await fs
    .remove(tombstone)
    .catch((e) => logger.warn(`[storage] remove tombstone failed: ${e.message}`))
}

/** 计划重启（延迟以让 IPC 响应先返回） */
function scheduleRelaunch(delay = 1200): void {
  setTimeout(() => {
    try {
      app.relaunch()
    } finally {
      app.exit(0)
    }
  }, delay)
}
