import { BaseRepository } from './base.repository'
import type {
  BloodPressureCreateInput,
  BloodPressureRecord,
  BloodPressureUpdateInput
} from '../../../../shared/domain/blood-pressure'
import type { PageQuery, PageResult } from '../../../../shared/domain/common'
import { normalizePageQuery } from '../../../../shared/domain/common'

/**
 * 血压记录仓库（表 blood_pressure）。
 * 所有 SQL 均使用预处理语句，避免拼接注入。
 */
export class BloodPressureRepository extends BaseRepository {
  /** 新增一条记录，返回自增主键 */
  create(input: BloodPressureCreateInput): number {
    const now = this.now()
    const result = this.db
      .prepare(
        `INSERT INTO blood_pressure
           (codeBar, status, dataType, createTime, updateTime, collectTime, userNum,
            leftDbp, leftSbp, rightDbp, rightSbp, pulse)
         VALUES
           (@codeBar, @status, @dataType, @createTime, @updateTime, @collectTime, @userNum,
            @leftDbp, @leftSbp, @rightDbp, @rightSbp, @pulse)`
      )
      .run({
        codeBar: input.codeBar,
        status: input.status ?? 0,
        dataType: input.dataType ?? 'BP',
        createTime: input.createTime ?? now,
        updateTime: now,
        collectTime: input.collectTime ?? now,
        userNum: input.userNum ?? null,
        leftDbp: input.leftDbp ?? null,
        leftSbp: input.leftSbp ?? null,
        rightDbp: input.rightDbp ?? null,
        rightSbp: input.rightSbp ?? null,
        pulse: input.pulse ?? null
      })
    return Number(result.lastInsertRowid)
  }

  /** 按主键更新（仅更新传入的字段） */
  update(input: BloodPressureUpdateInput): void {
    const fields = Object.keys(input).filter((key) => key !== 'id')
    if (fields.length === 0) return

    const assignments = fields.map((field) => `${field} = @${field}`).join(', ')
    this.db
      .prepare(`UPDATE blood_pressure SET ${assignments}, updateTime = @updateTime WHERE id = @id`)
      .run({ ...input, updateTime: this.now() })
  }

  /** 更新上传/保存状态 */
  updateStatus(id: number, status: number): void {
    this.db
      .prepare('UPDATE blood_pressure SET status = ?, updateTime = ? WHERE id = ?')
      .run(status, this.now(), id)
  }

  /** 按主键查询 */
  findById(id: number): BloodPressureRecord | null {
    const row = this.db.prepare('SELECT * FROM blood_pressure WHERE id = ?').get(id)
    return (row as BloodPressureRecord) ?? null
  }

  /** 待上传记录（status = 0），按采集时间升序 */
  listPendingUpload(limit = 100): BloodPressureRecord[] {
    return this.db
      .prepare('SELECT * FROM blood_pressure WHERE status = 0 ORDER BY id ASC LIMIT ?')
      .all(limit) as BloodPressureRecord[]
  }

  /** 分页查询 */
  query(query: PageQuery = {}): PageResult<BloodPressureRecord> {
    const { pageNum, pageSize, keyword, isUpload, beginDate, endDate, sortName, sortOrder } =
      normalizePageQuery(query)

    const where: string[] = []
    const params: Record<string, unknown> = {}

    if (keyword) {
      where.push('codeBar LIKE @keyword')
      params.keyword = `%${keyword}%`
    }
    if (isUpload === 'Y' || isUpload === 'N') {
      where.push('status = @status')
      params.status = isUpload === 'Y' ? 1 : 0
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

    // 排序（白名单列，避免注入）
    const sortable: Record<string, string> = {
      id: 'id',
      codeBar: 'codeBar',
      collectTime: 'collectTime',
      createTime: 'createTime',
      status: 'status'
    }
    let orderSql = 'ORDER BY id DESC'
    if (sortName && sortable[sortName] && sortOrder) {
      const dir = /^asc/i.test(sortOrder) ? 'ASC' : 'DESC'
      orderSql = `ORDER BY ${sortable[sortName]} ${dir}`
    }

    const totalRow = this.db
      .prepare(`SELECT COUNT(*) AS total FROM blood_pressure ${whereSql}`)
      .get(params) as { total: number }

    const rows = this.db
      .prepare(`SELECT * FROM blood_pressure ${whereSql} ${orderSql} LIMIT @limit OFFSET @offset`)
      .all({
        ...params,
        limit: pageSize,
        offset: (pageNum - 1) * pageSize
      }) as BloodPressureRecord[]

    return { rows, total: totalRow.total, pageNum, pageSize }
  }

  /** 统计总数（可按状态） */
  count(status?: number): number {
    if (status === undefined) {
      const row = this.db.prepare('SELECT COUNT(*) AS total FROM blood_pressure').get() as {
        total: number
      }
      return row.total
    }
    const row = this.db
      .prepare('SELECT COUNT(*) AS total FROM blood_pressure WHERE status = ?')
      .get(status) as { total: number }
    return row.total
  }

  /** 按主键批量删除 */
  remove(ids: number[]): void {
    const valid = ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))
    if (valid.length === 0) return
    const placeholders = valid.map(() => '?').join(', ')
    this.db.prepare(`DELETE FROM blood_pressure WHERE id IN (${placeholders})`).run(...valid)
  }
}
