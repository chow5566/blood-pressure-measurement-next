import type Database from 'better-sqlite3'
import { getDb } from '../connection'
import { formatDateTime } from '../../../utils/datetime'

/**
 * 仓库基类：统一提供数据库访问与公共辅助方法。
 * 子类通过 `this.db` 获取连接，通过 `this.now()` 生成时间戳。
 */
export abstract class BaseRepository {
  /** 当前数据库连接（未打开会抛错） */
  protected get db(): Database.Database {
    return getDb()
  }

  /** 统一的本地时间字符串 */
  protected now(): string {
    return formatDateTime()
  }
}
