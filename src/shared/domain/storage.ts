/**
 * 本地存储与迁移相关类型。
 * 设计说明见 docs/10-storage-and-migration.md。
 */

/** Windows 逻辑盘类型（Win32_LogicalDisk.DriveType） */
export enum DriveType {
  Unknown = 0,
  NoRootDirectory = 1,
  Removable = 2,
  Fixed = 3,
  Network = 4,
  CdRom = 5,
  RamDisk = 6
}

/** 磁盘信息 */
export interface DriveInfo {
  /** 盘符，如 'C:' */
  drive: string
  /** 总容量（字节） */
  totalBytes: number
  /** 剩余容量（字节） */
  freeBytes: number
  /** 盘类型 */
  driveType: DriveType
  /** 是否为本地固定磁盘（唯一允许作为数据目录的介质） */
  isLocalDisk: boolean
}

/** 本地存储信息（用于设置页展示） */
export interface StorageInfo {
  /** 当前数据目录 */
  dataDir: string
  /** 目录是否存在 */
  exists: boolean
  /** 数据目录占用（字节） */
  usedBytes: number
  /** 所在磁盘信息（取不到时为 null） */
  drive: DriveInfo | null
}

/** 数据目录校验结果 */
export interface StorageValidateResult {
  ok: boolean
  /** 失败原因（ok=false 时） */
  reason?: string
  /** 目标磁盘信息 */
  drive?: DriveInfo | null
  /** 当前数据目录占用 */
  currentBytes?: number
  /** 迁移所需空间（含余量） */
  requiredBytes?: number
}

/** 迁移进度阶段 */
export type MigratePhase =
  | 'idle'
  | 'precheck' // 预检
  | 'freeze' // 冻结写入、关闭数据库
  | 'copy' // 复制
  | 'verify' // 校验
  | 'switch' // 切换配置指针
  | 'cleanup' // 删除旧数据
  | 'reopen' // 重新打开数据库
  | 'done'
  | 'failed'

/** 迁移进度事件 */
export interface MigrateProgress {
  phase: MigratePhase
  /** 0~100 */
  percent: number
  copiedBytes: number
  totalBytes: number
  message?: string
}

/** 迁移结果 */
export interface MigrateResult {
  ok: boolean
  from?: string
  to?: string
  message?: string
}

/** 低空间预警信息 */
export interface LowSpaceInfo {
  dataDir: string
  freeBytes: number
  thresholdBytes: number
}

/** 磁盘空间阈值 */
export const SPACE_THRESHOLD = {
  /** 低空间预警：剩余 < 2GB */
  warnBytes: 2 * 1024 * 1024 * 1024,
  /** 硬阈值：剩余 < 500MB 时禁止新采集入库 */
  blockBytes: 500 * 1024 * 1024,
  /** 迁移所需额外余量（复制期间临时占用） */
  migrateExtraBytes: 200 * 1024 * 1024,
  /** 迁移空间系数（校验/临时开销） */
  migrateFactor: 1.15
} as const
