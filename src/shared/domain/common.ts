/**
 * 通用领域类型：分页、操作结果等。
 * 该目录（src/shared）下的类型同时被主进程与渲染进程引用，禁止引入 Node/Electron API。
 */

/** 是否已上传到服务器 */
export type UploadFlag = 'Y' | 'N'

/** 通用分页查询参数 */
export interface PageQuery {
  /** 页码，从 1 开始（默认 1） */
  pageNum?: number
  /** 每页条数（默认 20，最大 200） */
  pageSize?: number
  /** 关键字（不同实体含义不同：条码号/姓名/身份证等） */
  keyword?: string
  /** 上传状态过滤 */
  isUpload?: UploadFlag
  /** 检查类型过滤（B超：GW 公卫 / BS 商业） */
  checkType?: string
  /** 开始日期（含），格式 YYYY-MM-DD */
  beginDate?: string
  /** 结束日期（含），格式 YYYY-MM-DD */
  endDate?: string
  /** 排序字段（仅数据层白名单列生效） */
  sortName?: string
  /** 排序方向：asc / desc（兼容 el-table 的 ascending/descending） */
  sortOrder?: string
}

/** 通用分页结果 */
export interface PageResult<T> {
  rows: T[]
  total: number
  pageNum: number
  pageSize: number
}

/** 通用操作结果 */
export interface OperationResult {
  ok: boolean
  message?: string
}

/** 分页参数归一化，避免非法值（负数、超大）导致查询异常 */
export function normalizePageQuery(
  query: PageQuery = {}
): Required<Pick<PageQuery, 'pageNum' | 'pageSize'>> & PageQuery {
  const pageNum = Math.max(1, Math.floor(Number(query.pageNum) || 1))
  const pageSize = Math.min(200, Math.max(1, Math.floor(Number(query.pageSize) || 20)))
  return { ...query, pageNum, pageSize }
}
