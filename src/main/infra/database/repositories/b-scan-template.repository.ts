import { BaseRepository } from './base.repository'
import type { BScanTemplate } from '../../../../shared/domain/b-scan'

const WRITABLE_COLUMNS = [
  'id',
  'parentId',
  'dataType',
  'typeName',
  'typeDesc',
  'title',
  'diagnosis',
  'diagnosisDetails',
  'sortNum',
  'isPublic'
] as const

/**
 * B超报告模板仓库（表 b_scan_template）。
 */
export class BScanTemplateRepository extends BaseRepository {
  /** 新增或更新（以 id 为冲突键） */
  upsert(template: BScanTemplate): void {
    const now = this.now()
    const params: Record<string, unknown> = {
      createTime: template.createTime ?? now,
      updateTime: now
    }
    for (const column of WRITABLE_COLUMNS) {
      // isPublic 为布尔，入库转 0/1
      if (column === 'isPublic') {
        params[column] = template.isPublic ? 1 : 0
      } else {
        params[column] = template[column] ?? null
      }
    }

    const columns = WRITABLE_COLUMNS.join(', ')
    const placeholders = WRITABLE_COLUMNS.map((column) => `@${column}`).join(', ')
    const updates = WRITABLE_COLUMNS.filter((column) => column !== 'id')
      .map((column) => `${column} = @${column}`)
      .join(', ')

    this.db
      .prepare(
        `INSERT INTO b_scan_template (${columns}, createTime, updateTime)
         VALUES (${placeholders}, @createTime, @updateTime)
         ON CONFLICT(id) DO UPDATE SET ${updates}, updateTime = @updateTime`
      )
      .run(params)
  }

  /** 按主键查询 */
  findById(id: string): BScanTemplate | null {
    const row = this.db.prepare('SELECT * FROM b_scan_template WHERE id = ?').get(id)
    return row ? mapTemplate(row as Record<string, unknown>) : null
  }

  /**
   * 查询模板列表。
   * @param dataType 可选：TEMPLATE 模板 / TYPE 类型
   * @param keyword 可选：按标题/类型名模糊匹配
   */
  list(dataType?: string, keyword?: string): BScanTemplate[] {
    const where: string[] = []
    const params: Record<string, unknown> = {}
    if (dataType) {
      where.push('dataType = @dataType')
      params.dataType = dataType
    }
    if (keyword) {
      where.push('(title LIKE @keyword OR typeName LIKE @keyword)')
      params.keyword = `%${keyword}%`
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const rows = this.db
      .prepare(`SELECT * FROM b_scan_template ${whereSql} ORDER BY sortNum ASC, createTime ASC`)
      .all(params) as Array<Record<string, unknown>>
    return rows.map(mapTemplate)
  }

  /** 删除 */
  delete(id: string): void {
    this.db.prepare('DELETE FROM b_scan_template WHERE id = ?').run(id)
  }

  /** 批量 upsert（用于同步公共模板） */
  upsertMany(list: BScanTemplate[]): void {
    const run = this.db.transaction((items: BScanTemplate[]) => {
      for (const item of items) this.upsert(item)
    })
    run(list)
  }

  /** 删除全部公共模板（同步前清空） */
  deletePublic(): void {
    this.db.prepare('DELETE FROM b_scan_template WHERE isPublic = 1').run()
  }
}

/** 行记录 → 领域对象（isPublic 由 0/1 转 boolean） */
function mapTemplate(row: Record<string, unknown>): BScanTemplate {
  return {
    ...(row as unknown as BScanTemplate),
    isPublic: Number(row.isPublic) === 1
  }
}
