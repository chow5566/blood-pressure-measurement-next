/**
 * 血压测量领域模型。
 * 字段与旧库（TypeORM 生成的 camelCase 列名）保持一致，确保旧数据可读。
 */

/** 上传/保存状态：0 未上传，1 已上传 */
export enum BloodPressureStatus {
  Pending = 0,
  Uploaded = 1
}

/** 用户标识：1 = 左侧，2 = 右侧（血压计上的用户 A/B） */
export enum BloodPressureSide {
  Left = 1,
  Right = 2
}

/** 启动测量指令 */
export const BP_START_DIRECTIVE = [0xcc, 0x80, 0x03, 0x03, 0x01, 0x02, 0x00, 0x03]
/** 停止测量指令 */
export const BP_STOP_DIRECTIVE = [0xcc, 0x80, 0x03, 0x03, 0x01, 0x03, 0x00, 0x03]

/** 血压计测量错误码 → 文案（与设备协议对应） */
export const BLOOD_PRESSURE_ERROR_MAP: Record<number, string> = {
  1: '血压计臂筒内上游气囊压力超过安全压力',
  2: '血压计测量中手臂放置不正确或臂筒内上游气囊漏气',
  5: '血压计测量中手臂放置不正确或臂筒内下游气囊漏气',
  6: '血压计手臂放置方式不正确或脉搏传感器无信号',
  7: '血压计电量不足，请充电',
  9: '血压计臂筒内气囊放气时间过长'
}

/** 血压记录（对应表 blood_pressure） */
export interface BloodPressureRecord {
  /** 主键（自增） */
  id?: number
  /** 条码号 */
  codeBar: string
  /** 保存/上传状态 */
  status: BloodPressureStatus
  /** 数据类型，血压为 'BP' */
  dataType: string
  /** 创建时间 */
  createTime?: string
  /** 更新时间 */
  updateTime?: string
  /** 采集时间 */
  collectTime?: string
  /** 用户标识（左/右） */
  userNum: BloodPressureSide | number
  /** 左侧舒张压 */
  leftDbp?: number | null
  /** 左侧收缩压 */
  leftSbp?: number | null
  /** 右侧舒张压 */
  rightDbp?: number | null
  /** 右侧收缩压 */
  rightSbp?: number | null
  /** 脉率 */
  pulse: number | null
}

/** 新增血压记录的入参（id/更新时间由数据层生成；创建时间可显式指定用于数据导入） */
export type BloodPressureCreateInput = Omit<BloodPressureRecord, 'id' | 'updateTime'> & {
  createTime?: string
}

/** 更新血压记录的入参 */
export type BloodPressureUpdateInput = Partial<Omit<BloodPressureRecord, 'id' | 'createTime'>> & {
  id: number
}

/** 血压计串口设备（已按 VID/PID 过滤） */
export interface BpPort {
  /** 串口路径，如 'COM3' */
  path: string
  /** 设备实例标识（用于事件隔离） */
  pnpId?: string
  /** 友好名称 */
  friendlyName?: string
  vendorId?: string
  productId?: string
}

/** 从设备收到的解析后帧 */
export type BloodPressureFrame =
  | { kind: 'error'; code: number }
  | { kind: 'progress'; sbp: number; dbp: number }
  | { kind: 'result'; userNum: number; sbp: number; dbp: number; pulse: number | null }
  | { kind: 'unknown' }

/** 渲染进程提交一次测量结果 */
export interface BloodPressureSubmitInput {
  codeBar: string
  /** 1 左 / 2 右 */
  userNum: number
  sbp: number
  dbp: number
  pulse: number | null
  /** 采集时间（缺省由主进程生成） */
  collectTime?: string
}

/** 一次测量落库 + 上传的结果 */
export interface BloodPressureRecordResult {
  id: number
  codeBar: string
  /** 是否已上传成功 */
  uploaded: boolean
  /** 失败/提示信息 */
  message?: string
}

/** 批量补传失败项 */
export interface BloodPressureUploadFailure {
  id?: number
  codeBar: string
  message: string
}

/** 批量补传结果 */
export interface BloodPressureUploadResult {
  total: number
  success: number
  failed: BloodPressureUploadFailure[]
}

/** 主 → 渲染 的血压数据事件负载 */
export interface BloodPressureDataEvent {
  path: string
  frame: BloodPressureFrame
}
