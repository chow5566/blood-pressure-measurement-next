import { join } from 'node:path'
import { logger } from '../logger'
import { openDatabase, closeDatabase } from './connection'
import { runMigrations } from './migrations'
import { BloodPressureRepository } from './repositories/blood-pressure.repository'
import { BScanRepository } from './repositories/b-scan.repository'
import { BScanImagesRepository } from './repositories/b-scan-images.repository'
import { BScanTemplateRepository } from './repositories/b-scan-template.repository'

export { openDatabase, getDb, closeDatabase, isDatabaseOpen, getDatabaseFile } from './connection'
export type { Migration } from './migrations/types'

/** 数据库文件名（沿用旧库命名，便于兼容） */
const DB_FILE_NAME = 'index.db'

/** 数据库文件路径：<dataDir>/database/index.db */
export function resolveDatabaseFile(dataDir: string): string {
  return join(dataDir, 'database', DB_FILE_NAME)
}

/** 仓库实例（惰性创建，持有即可，内部每次都取当前连接） */
export const repositories = {
  bloodPressure: new BloodPressureRepository(),
  bScan: new BScanRepository(),
  bScanImages: new BScanImagesRepository(),
  bScanTemplate: new BScanTemplateRepository()
}

/**
 * 初始化数据库：打开连接 + 执行迁移。
 * @param dataDir 数据目录
 * @returns 本次应用的迁移 id 列表
 */
export function initDatabase(dataDir: string): { file: string; applied: number[] } {
  const file = resolveDatabaseFile(dataDir)
  const db = openDatabase(file)
  const applied = runMigrations(db)
  logger.info(`[db] ready at ${file}${applied.length ? `, applied=${applied.join(',')}` : ''}`)
  return { file, applied }
}

/**
 * 关闭数据库（迁移数据目录前调用）。
 * 幂等：未打开时安全返回。
 */
export function shutdownDatabase(): void {
  closeDatabase()
}
