import { BaseRepository } from './base.repository'
import type { BScanRecord } from '../../../../shared/domain/b-scan'
import type { PageQuery, PageResult } from '../../../../shared/domain/common'
import { normalizePageQuery } from '../../../../shared/domain/common'

/** upsert 时可写入的列（排除运行时的 images） */
const WRITABLE_COLUMNS = [
  'barcode',
  'checkType',
  'name',
  'idCard',
  'gender',
  'birthday',
  'isUpload',
  'isNormal',
  'diagnosis',
  'bodyParts',
  'diagnosisDetails',
  'localRemark'
] as const

/**
 * B超检查记录仓库（表 b_scan_entity，主键 barcode）。
 */
export class BScanRepository extends BaseRepository {
  /** 新增或更新（以 barcode 为冲突键） */
  upsert(record: BScanRecord): void {
    const now = this.now()
    const params: Record<string, unknown> = {
      createTime: record.createTime ?? now,
      updateTime: now
    }
    for (const column of WRITABLE_COLUMNS) {
      params[column] = record[column] ?? null
    }

    const columns = WRITABLE_COLUMNS.join(', ')
    const placeholders = WRITABLE_COLUMNS.map((column) => `@${column}`).join(', ')
    const updates = WRITABLE_COLUMNS.filter((column) => column !== 'barcode')
      .map((column) => `${column} = @${column}`)
      .join(', ')

    this.db
      .prepare(
        `INSERT INTO b_scan_entity (${columns}, createTime, updateTime)
         VALUES (${placeholders}, @createTime, @updateTime)
         ON CONFLICT(barcode) DO UPDATE SET ${updates}, updateTime = @updateTime`
      )
      .run(params)
  }

  /** 按条码查询 */
  findByBarcode(barcode: string): BScanRecord | null {
    const row = this.db.prepare('SELECT * FROM b_scan_entity WHERE barcode = ?').get(barcode)
    return (row as BScanRecord) ?? null
  }

  /** 更新上传状态 */
  markUploaded(barcode: string, isUpload: 'Y' | 'N'): void {
    this.db
      .prepare('UPDATE b_scan_entity SET isUpload = ?, updateTime = ? WHERE barcode = ?')
      .run(isUpload, this.now(), barcode)
  }

  /** 删除（图片由调用方按条码一并处理） */
  delete(barcode: string): void {
    this.db.prepare('DELETE FROM b_scan_entity WHERE barcode = ?').run(barcode)
  }

  /** 修改条码号 */
  changeBarcode(oldBarcode: string, newBarcode: string): void {
    this.db
      .prepare('UPDATE b_scan_entity SET barcode = ?, updateTime = ? WHERE barcode = ?')
      .run(newBarcode, this.now(), oldBarcode)
  }

  /** 分页查询 */
  query(query: PageQuery = {}): PageResult<BScanRecord> {
    const { pageNum, pageSize, keyword, isUpload, checkType, beginDate, endDate } =
      normalizePageQuery(query)

    const where: string[] = []
    const params: Record<string, unknown> = {}

    if (keyword) {
      where.push('(barcode LIKE @keyword OR name LIKE @keyword OR idCard LIKE @keyword)')
      params.keyword = `%${keyword}%`
    }
    if (isUpload === 'Y' || isUpload === 'N') {
      where.push('isUpload = @isUpload')
      params.isUpload = isUpload
    }
    if (checkType) {
      where.push('checkType = @checkType')
      params.checkType = checkType
    }
    if (beginDate) {
      where.push('createTime >= @beginDate')
      params.beginDate = `${beginDate} 00:00:00`
    }
    if (endDate) {
      where.push('createTime <= @endDate')
      params.endDate = `${endDate} 23:59:59`
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const totalRow = this.db
      .prepare(`SELECT COUNT(*) AS total FROM b_scan_entity ${whereSql}`)
      .get(params) as { total: number }

    const rows = this.db
      .prepare(
        `SELECT * FROM b_scan_entity ${whereSql} ORDER BY createTime DESC, barcode DESC LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit: pageSize, offset: (pageNum - 1) * pageSize }) as BScanRecord[]

    return { rows, total: totalRow.total, pageNum, pageSize }
  }

  /** 统计总数 */
  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS total FROM b_scan_entity').get() as {
      total: number
    }
    return row.total
  }
}
