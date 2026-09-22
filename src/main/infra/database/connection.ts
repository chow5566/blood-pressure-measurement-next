import Database from 'better-sqlite3'
import { dirname } from 'node:path'
import { mkdirSync } from 'node:fs'

/**
 * SQLite 连接管理（better-sqlite3）。
 *
 * 设计要点：
 * - 单例。整个主进程共用同一个连接；迁移/切换数据目录前必须先 close。
 * - WAL 模式：读写并发更好，崩溃恢复更稳（数据目录禁止放在网络盘）。
 * - busy_timeout：避免瞬时锁冲突直接报错。
 * - closeDatabase() 用于迁移前释放 Windows 文件锁。
 */

let instance: Database.Database | null = null
let currentFile: string | null = null

/** 打开（或复用）数据库连接 */
export function openDatabase(file: string): Database.Database {
  if (instance && currentFile === file) {
    return instance
  }
  // 切换到不同文件时，先关闭旧连接
  if (instance) {
    closeDatabase()
  }

  // 确保父目录存在
  mkdirSync(dirname(file), { recursive: true })

  const db = new Database(file)
  // WAL：提升并发与稳定性；synchronous=NORMAL 在 WAL 下安全且更快
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  instance = db
  currentFile = file
  return db
}

/** 获取当前连接，未打开则抛错（编程错误，尽早暴露） */
export function getDb(): Database.Database {
  if (!instance) {
    throw new Error('Database is not open. Call openDatabase() first.')
  }
  return instance
}

/** 关闭连接（迁移前必须调用，释放文件句柄） */
export function closeDatabase(): void {
  if (!instance) return
  try {
    instance.close()
  } finally {
    instance = null
    currentFile = null
  }
}

/** 当前数据库是否已连接 */
export function isDatabaseOpen(): boolean {
  return instance !== null
}

/** 当前数据库文件路径 */
export function getDatabaseFile(): string | null {
  return currentFile
}
