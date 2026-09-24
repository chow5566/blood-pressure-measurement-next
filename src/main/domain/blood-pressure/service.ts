import { repositories } from '../../infra/database'
import { uploadBloodPressure } from '../../infra/http/uploader'
import { assertSpaceForWrite } from '../../infra/storage'
import { maintenance } from '../../infra/maintenance'
import { getBpAutoUpload } from '../../config'
import { isOnline } from '../../infra/network'
import { formatDateTime } from '../../utils/datetime'
import { BloodPressureStatus } from '../../../shared/domain/blood-pressure'
import type {
  BloodPressureRecord,
  BloodPressureRecordResult,
  BloodPressureSkipReason,
  BloodPressureSubmitInput,
  BloodPressureUploadFailure,
  BloodPressureUploadResult
} from '../../../shared/domain/blood-pressure'
import type { PageQuery, PageResult } from '../../../shared/domain/common'

/**
 * 血压业务服务：一次测量的「落库 + 上传」。
 *
 * 流程（与旧实现语义一致）：
 * 1. 先写本地库（status=0 未上传），保证离线不丢数据；
 * 2. 组装 dataContent 上传服务器；
 * 3. 上传成功则更新 status=1；失败保留本地，返回失败信息由 UI 提示。
 */

/** 提交一次测量结果 */
export async function recordBloodPressure(
  input: BloodPressureSubmitInput
): Promise<BloodPressureRecordResult> {
  const codeBar = input.codeBar?.trim()
  if (!codeBar) {
    throw new Error('条码号不能为空')
  }

  // 磁盘空间守卫：过低时阻止写入，避免写坏数据库
  await assertSpaceForWrite()
  // 维护模式守卫：迁移/备份期间禁止写入
  maintenance.assertWritable()

  const collectTime = input.collectTime ?? formatDateTime()
  const isRight = input.userNum === 2

  // 1) 先落库
  const id = repositories.bloodPressure.create({
    codeBar,
    status: BloodPressureStatus.Pending,
    dataType: 'BP',
    collectTime,
    userNum: input.userNum,
    leftSbp: isRight ? null : input.sbp,
    leftDbp: isRight ? null : input.dbp,
    rightSbp: isRight ? input.sbp : null,
    rightDbp: isRight ? input.dbp : null,
    pulse: input.pulse
  })

  // 2) 组装上传内容（字段与旧实现保持一致，后端接口不可修改）
  const dataContent: Record<string, unknown> = {
    status: 0,
    dataType: 'BP',
    codeBar,
    userNum: input.userNum,
    collectTime,
    dbp: input.dbp,
    sbp: input.sbp,
    pulse: input.pulse
  }
  if (isRight) {
    dataContent.rightSbp = input.sbp
    dataContent.rightDbp = input.dbp
  } else {
    dataContent.leftSbp = input.sbp
    dataContent.leftDbp = input.dbp
  }

  // 3) 上传：关闭自动上传或网络未连接时直接本地留存，避免无谓的 HTTP 等待
  let uploaded = false
  let reason: BloodPressureSkipReason | undefined
  let message: string | undefined

  if (!getBpAutoUpload()) {
    reason = 'disabled'
  } else if (!isOnline()) {
    reason = 'offline'
    message = '网络未连接'
  } else {
    const upload = await uploadBloodPressure(dataContent)
    uploaded = upload.ok
    if (upload.ok) {
      repositories.bloodPressure.updateStatus(id, BloodPressureStatus.Uploaded)
    } else {
      reason = 'failed'
      message = upload.message
    }
  }

  return { id, codeBar, uploaded, reason, message }
}

/** 分页查询血压历史 */
export function pageBloodPressure(query: PageQuery = {}): PageResult<BloodPressureRecord> {
  return repositories.bloodPressure.query(query)
}

/** 批量删除血压记录 */
export function removeBloodPressure(ids: number[]): void {
  repositories.bloodPressure.remove(ids)
}

/**
 * 批量补传血压记录（字段与旧实现的历史补传保持一致）。
 * 逐条上传，成功则更新本地 status=1；返回成功/失败明细。
 */
export async function uploadBloodPressureRecords(
  ids: number[]
): Promise<BloodPressureUploadResult> {
  const failed: BloodPressureUploadFailure[] = []
  let success = 0

  for (const id of ids) {
    const record = repositories.bloodPressure.findById(id)
    if (!record) {
      failed.push({ id, codeBar: '', message: '记录不存在' })
      continue
    }

    const dataContent: Record<string, unknown> = {
      id: record.id,
      codeBar: record.codeBar,
      collectTime: record.collectTime,
      leftSbp: record.leftSbp ?? null,
      leftDbp: record.leftDbp ?? null,
      rightSbp: record.rightSbp ?? null,
      rightDbp: record.rightDbp ?? null,
      pulse: record.pulse ?? null,
      status: 1
    }

    const upload = await uploadBloodPressure(dataContent)
    if (upload.ok) {
      repositories.bloodPressure.updateStatus(id, BloodPressureStatus.Uploaded)
      success += 1
    } else {
      failed.push({ id, codeBar: record.codeBar, message: upload.message || '上传失败' })
    }
  }

  return { total: ids.length, success, failed }
}
