import type Database from 'better-sqlite3'

/**
 * 一次数据库迁移。
 * - id 必须严格递增且不重复，作为已应用标记写入 `schema_migrations`。
 * - up() 内部使用 `IF NOT EXISTS` 保证对旧库（TypeORM 生成）安全。
 */
export interface Migration {
  id: number
  name: string
  up: (db: Database.Database) => void
}
