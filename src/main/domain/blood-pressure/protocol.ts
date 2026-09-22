import type { BloodPressureFrame } from '../../../shared/domain/blood-pressure'

/**
 * 血压计串口协议（迈宝/maibobo 类设备，VID 1A86 / PID 7523）。
 *
 * 指令为固定字节序列；设备上报数据帧的解析规则来自旧实现：
 * - 第 5 字节为帧类型：7 错误 / 5 临时数据 / 6 测量结果
 * - 第 6 字节：错误时为错误码；结果帧为用户标识（1 左 / 2 右）
 * - 结果帧：第 13~18 字节为血压数组 [SYS_H, SYS_L, DIA_H, DIA_L, PULSE_H, PULSE_L]
 *   SYS = SYS_H*256 + SYS_L，DIA = DIA_H*256 + DIA_L，PULSE = PULSE_L
 */

/** 帧类型枚举 */
const FRAME_TYPE = {
  ERROR: 7,
  PROGRESS: 5,
  RESULT: 6
} as const

/**
 * 解析一帧设备数据。
 * @param data 串口原始字节
 * @returns 结构化帧；无法识别时返回 { kind: 'unknown' }
 */
export function parseBloodPressureFrame(data: Uint8Array | number[]): BloodPressureFrame {
  const bytes = Array.from(data)
  const frameType = bytes[5]
  const sixth = bytes[6]

  if (frameType === FRAME_TYPE.ERROR) {
    return { kind: 'error', code: sixth }
  }

  if (frameType === FRAME_TYPE.PROGRESS) {
    // 临时数据：第 6 字节为舒张压，第 7 字节为收缩压
    return { kind: 'progress', sbp: bytes[7] || 0, dbp: bytes[6] || 0 }
  }

  if (frameType === FRAME_TYPE.RESULT) {
    const bp = bytes.slice(13, 19)
    return {
      kind: 'result',
      userNum: sixth,
      sbp: (bp[0] ?? 0) * 256 + (bp[1] ?? 0),
      dbp: (bp[2] ?? 0) * 256 + (bp[3] ?? 0),
      pulse: bp[5] || null
    }
  }

  return { kind: 'unknown' }
}
