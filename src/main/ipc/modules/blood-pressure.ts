import { handle, broadcast } from '../registry'
import { bpDevice } from '../../infra/hardware/serial/bp-device'
import { parseBloodPressureFrame } from '../../domain/blood-pressure/protocol'
import {
  pageBloodPressure,
  recordBloodPressure,
  removeBloodPressure,
  uploadBloodPressureRecords
} from '../../domain/blood-pressure/service'
import { logger } from '../../infra/logger'

/**
 * 血压计 IPC：设备列举、串口开关、指令下发、测量落库。
 * 数据帧与设备变化通过事件推送给渲染进程。
 */
export function registerBloodPressureIpc(): void {
  handle('bp:list-ports', () => bpDevice.list())

  handle('bp:open', async (_event, path) => {
    await bpDevice.open(path)
    return { ok: true }
  })

  handle('bp:send', async (_event, path, command) => {
    await bpDevice.send(path, command)
    return { ok: true }
  })

  handle('bp:close-all', async () => {
    await bpDevice.closeAll()
  })

  handle('bp:record', (_event, input) => recordBloodPressure(input))

  handle('bp:page', (_event, query) => pageBloodPressure(query))
  handle('bp:delete', (_event, ids) => removeBloodPressure(ids))
  handle('bp:upload', (_event, ids) => uploadBloodPressureRecords(ids))
}

/**
 * 把设备层的原始数据解析后广播给渲染进程，并启动设备插拔轮询。
 * 在 bootstrap 中调用一次。
 */
export function initBloodPressureBridge(): void {
  bpDevice.onData((path, data) => {
    broadcast('bp:data', { path, frame: parseBloodPressureFrame(data) })
  })

  bpDevice.onDevices((ports) => {
    broadcast('bp:devices', ports)
  })

  bpDevice.startWatch()
  logger.info('[bp] bridge initialized')
}

/** 应用退出时释放串口与轮询 */
export async function disposeBloodPressure(): Promise<void> {
  bpDevice.stopWatch()
  await bpDevice.closeAll()
}
