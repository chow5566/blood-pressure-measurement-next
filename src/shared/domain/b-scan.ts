/**
 * B超领域模型：检查记录、图片、报告模板。
 * 字段与旧库（TypeORM camelCase 列名）保持一致，确保旧数据可读。
 */
import type { UploadFlag } from './common'

/** 检查类型：GW 公卫 / BS 商业 */
export type BScanCheckType = 'GW' | 'BS'

/** B超检查记录（对应表 b_scan_entity，主键为条码号） */
export interface BScanRecord {
  /** 条码号（主键） */
  barcode: string
  /** 检查类型 */
  checkType?: BScanCheckType | string
  /** 姓名 */
  name?: string
  /** 身份证号 */
  idCard?: string
  /** 性别（'1' 男 / '2' 女，沿用旧约定） */
  gender?: string
  /** 出生日期 */
  birthday?: string
  /** 是否已上传：Y/N */
  isUpload?: UploadFlag
  /** 检查结果（是否正常等） */
  isNormal?: string
  /** 诊断结果 */
  diagnosis?: string
  /** 检测部位 */
  bodyParts?: string
  /** 诊断描述 */
  diagnosisDetails?: string
  /** 本地备注 */
  localRemark?: string
  /** 图片集合（运行时聚合，不直接入库） */
  images?: BScanImage[]
  /** 创建时间 */
  createTime?: string
  /** 更新时间 */
  updateTime?: string
}

/** B超图片（对应表 b_scan_images_entity） */
export interface BScanImage {
  /** 主键（uuid） */
  id?: string
  /** 对应条码号 */
  barcode?: string
  /** 是否已上传：Y/N */
  isUpload?: UploadFlag
  /** 是否选中（仅 UI 使用，入库可忽略） */
  isCheck?: UploadFlag
  /** 图片序号 */
  sortNum?: number
  /** 本地图片路径 */
  localPath?: string
  /** 上传后的路径 */
  uploadUrl?: string
  /** 创建时间 */
  createTime?: string
  /** 更新时间 */
  updateTime?: string
  /**
   * 图片 base64（仅用于传输/预览，不持久化到数据库）。
   * 类型上用可选字段承载，仓库层会显式剔除。
   */
  base64Path?: string | null
}

/** 模板数据类型：TEMPLATE 模板 / TYPE 类型分组 */
export type BScanTemplateDataType = 'TEMPLATE' | 'TYPE'

/** B超报告模板（对应表 b_scan_template） */
export interface BScanTemplate {
  /** 主键（uuid） */
  id?: string
  /** 父级 ID（默认 '00'） */
  parentId?: string
  /** 数据类型 */
  dataType?: BScanTemplateDataType
  /** 模板类型名称 */
  typeName?: string
  /** 模板类型描述 */
  typeDesc?: string
  /** 模板标题 */
  title?: string
  /** 诊断结果 */
  diagnosis?: string
  /** 诊断描述 */
  diagnosisDetails?: string
  /** 排序号 */
  sortNum?: number
  /** 是否公共模板 */
  isPublic?: boolean
  /** 创建时间 */
  createTime?: string
  /** 更新时间 */
  updateTime?: string
}

/** 报告渲染参数（主进程 docxtemplater 使用） */
export interface BScanReportParams {
  title?: string | null
  name?: string | null
  gender?: string | null
  age?: string | null
  barcode?: string | null
  diagnosis?: string | null
  diagnosisDetails?: string | null
  doctorName?: string | null
  createTime?: string | null
  image1?: string | null
  image2?: string | null
  image3?: string | null
  image4?: string | null
}

/** 保存 B超记录（含图片）的入参 */
export interface BScanSaveInput {
  record: BScanRecord
  images: BScanImage[]
  /** 是否已上传（保存时通常为 N） */
  isUpload?: UploadFlag
}

/** 上传 B超记录的入参 */
export interface BScanUploadInput {
  barcode: string
  /** 报告图片 base64（不含前缀），可选 */
  reportImageBase64?: string | null
}

/** B超操作结果 */
export interface BScanOperationResult {
  ok: boolean
  barcode?: string
  message?: string
}

/** 在线查询归一化结果 */
export interface OnlineBScanData {
  name?: string
  idCard?: string
  birthday?: string
  gender?: string
  diagnosis?: string
  diagnosisDetails?: string
  localRemark?: string
  images: BScanImage[]
}

/** 检查部位选项（与旧实现一致） */
export const BSCAN_BODY_PARTS = [
  { label: '胸部', value: '1' },
  { label: '甲状腺', value: '7' },
  { label: '腹部', value: '2' },
  { label: '胃肠道', value: '3' },
  { label: '泌尿系统', value: '4' },
  { label: '妇科', value: '5' },
  { label: '产科', value: '6' },
  { label: '颈部', value: '8' },
  { label: '乳腺', value: '9' },
  { label: '前列腺', value: '10' }
] as const
