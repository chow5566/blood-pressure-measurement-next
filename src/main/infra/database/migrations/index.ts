import type Database from 'better-sqlite3'
import { migration001 } from './001-init'
import type { Migration } from './types'
import { logger } from '../../logger'

/**
 * 迁移列表。新增迁移时在末尾追加，id 递增，切勿修改已发布的迁移内容。
 */
const MIGRATIONS: Migration[] = [migration001]

/** 记录表结构（必须最先创建） */
function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id        INTEGER PRIMARY KEY,
      name      TEXT    NOT NULL,
      appliedAt TEXT    NOT NULL
    );
  `)
}

/** 读取已应用的迁移 id 集合 */
function getAppliedIds(db: Database.Database): Set<number> {
  const rows = db.prepare('SELECT id FROM schema_migrations').all() as Array<{ id: number }>
  return new Set(rows.map((row) => row.id))
}

/**
 * 执行所有未应用的迁移。
 * 每个迁移在独立事务中执行，失败自动回滚。
 * @returns 本次实际应用的迁移 id 列表
 */
export function runMigrations(db: Database.Database): number[] {
  ensureMigrationsTable(db)
  const applied = getAppliedIds(db)
  const executed: number[] = []

  const ordered = [...MIGRATIONS].sort((a, b) => a.id - b.id)
  for (const migration of ordered) {
    if (applied.has(migration.id)) continue

    const apply = db.transaction(() => {
      migration.up(db)
      db.prepare('INSERT INTO schema_migrations (id, name, appliedAt) VALUES (?, ?, ?)').run(
        migration.id,
        migration.name,
        new Date().toISOString()
      )
    })

    apply()
    executed.push(migration.id)
    logger.info(`[db] migration applied: ${migration.id}-${migration.name}`)
  }

  return executed
}
