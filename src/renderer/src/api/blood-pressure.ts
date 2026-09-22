import type {
  BpPort,
  BloodPressureDataEvent,
  BloodPressureRecord,
  BloodPressureRecordResult,
  BloodPressureSubmitInput,
  BloodPressureUploadResult
} from '@shared/domain/blood-pressure'
import type { OperationResult, PageQuery, PageResult } from '@shared/domain/common'

/** 血压测量 API 封装 */
export const bloodPressureApi = {
  /** 血压计设备列表 */
  listPorts: (): Promise<BpPort[]> => window.api.invoke('bp:list-ports'),
  /** 打开串口 */
  open: (path: string): Promise<OperationResult> => window.api.invoke('bp:open', path),
  /** 发送指令 */
  send: (path: string, command: number[]): Promise<OperationResult> =>
    window.api.invoke('bp:send', path, command),
  /** 关闭全部串口 */
  closeAll: (): Promise<void> => window.api.invoke('bp:close-all'),
  /** 测量结果落库并上传 */
  record: (input: BloodPressureSubmitInput): Promise<BloodPressureRecordResult> =>
    window.api.invoke('bp:record', input),
  /** 分页查询历史 */
  page: (query: PageQuery): Promise<PageResult<BloodPressureRecord>> =>
    window.api.invoke('bp:page', query),
  /** 删除记录 */
  remove: (ids: number[]): Promise<void> => window.api.invoke('bp:delete', ids),
  /** 批量补传 */
  upload: (ids: number[]): Promise<BloodPressureUploadResult> =>
    window.api.invoke('bp:upload', ids),
  /** 订阅数据帧，返回取消订阅函数 */
  onData: (listener: (payload: BloodPressureDataEvent) => void): (() => void) =>
    window.api.on('bp:data', listener),
  /** 订阅设备变化，返回取消订阅函数 */
  onDevices: (listener: (ports: BpPort[]) => void): (() => void) =>
    window.api.on('bp:devices', listener)
}
