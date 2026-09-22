/** 存储模块统一出口（数据目录布局、信息查询、校验与迁移） */
export {
  ensureDataLayout,
  getStorageInfo,
  validateTargetDir,
  formatBytes,
  checkDataSpace,
  assertSpaceForWrite
} from './storage-service'
export type { SpaceCheckResult } from './storage-service'
export { migrateDataDir, isMigrating } from './migration-service'
export type { MigrateOptions } from './migration-service'
export {
  DATA_SUB_DIRS,
  databaseDir,
  imagesDir,
  imagesDirOfBarcode,
  reportsDir,
  tempDir,
  subDir,
  isInside,
  sanitizeSegment
} from './storage-paths'
export { getDriveInfo, getFolderSize } from './disk'
