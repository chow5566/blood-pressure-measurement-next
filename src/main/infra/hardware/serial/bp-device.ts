import { SerialPort } from 'serialport'
import { logger } from '../../logger'
import type { BpPort } from '../../../../shared/domain/blood-pressure'

/**
 * 血压计串口设备管理器。
 *
 * - 仅管理 VID `1A86` / PID `7523` 的血压计设备；
 * - 设备插拔通过**轮询** `SerialPort.list()` 检测（避免依赖原生 `usb` 模块，见 ADR-006）；
 * - 数据以事件回调形式抛出，由领域服务解析，IPC 层负责转发给渲染进程。
 */

const VENDOR_ID = '1A86'
const PRODUCT_ID = '7523'
const BAUD_RATE = 115200

type DataListener = (path: string, data: Buffer) => void
type DevicesListener = (ports: BpPort[]) => void

class BloodPressureDeviceManager {
  /** 已打开的串口，key 为路径 */
  private opened = new Map<string, SerialPort>()
  private dataListeners = new Set<DataListener>()
  private devicesListeners = new Set<DevicesListener>()
  private watchTimer: NodeJS.Timeout | null = null
  private lastSignature = ''

  /** 列出血压计设备（按 VID/PID 过滤，且要求 pnpId 有效） */
  async list(): Promise<BpPort[]> {
    try {
      const ports = await SerialPort.list()
      return ports
        .filter(
          (port) =>
            port.vendorId?.toUpperCase() === VENDOR_ID &&
            port.productId?.toUpperCase() === PRODUCT_ID &&
            port.pnpId
        )
        .map((port) => ({
          path: port.path,
          pnpId: port.pnpId,
          friendlyName: (port as { friendlyName?: string }).friendlyName,
          vendorId: port.vendorId,
          productId: port.productId
        }))
    } catch (error) {
      logger.error('[bp] list ports failed', error)
      throw new Error('获取血压计列表失败')
    }
  }

  /** 打开串口（幂等），并监听数据 */
  async open(path: string): Promise<void> {
    const existing = this.opened.get(path)
    if (existing?.isOpen) return

    // 先关闭同路径的旧实例，避免占用
    if (existing) {
      await this.closePort(path)
    }

    const port = new SerialPort({
      path,
      baudRate: BAUD_RATE,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      autoOpen: false
    })

    await new Promise<void>((resolve, reject) => {
      port.open((err) => (err ? reject(new Error(`打开串口失败：${err.message}`)) : resolve()))
    })

    port.on('data', (data: Buffer) => {
      for (const listener of this.dataListeners) listener(path, data)
    })
    port.on('error', (err) => logger.warn(`[bp] serial error on ${path}: ${err.message}`))

    this.opened.set(path, port)
    logger.info(`[bp] port opened: ${path}`)
  }

  /** 发送指令；写入成功即 resolve，失败 reject */
  async send(path: string, command: number[]): Promise<void> {
    const port = this.opened.get(path)
    if (!port?.isOpen) {
      throw new Error('端口未打开，请重新识别血压计')
    }
    await new Promise<void>((resolve, reject) => {
      port.write(Buffer.from(command), (err) =>
        err ? reject(new Error(`发送指令失败：${err.message}`)) : resolve()
      )
    })
  }

  /** 关闭指定串口 */
  private closePort(path: string): Promise<void> {
    const port = this.opened.get(path)
    if (!port) return Promise.resolve()
    return new Promise<void>((resolve) => {
      if (!port.isOpen) {
        this.opened.delete(path)
        resolve()
        return
      }
      port.close(() => {
        this.opened.delete(path)
        resolve()
      })
    })
  }

  /** 关闭全部串口（页面卸载/应用退出） */
  async closeAll(): Promise<void> {
    await Promise.all([...this.opened.keys()].map((path) => this.closePort(path)))
  }

  /** 订阅数据，返回取消订阅函数 */
  onData(listener: DataListener): () => void {
    this.dataListeners.add(listener)
    return () => this.dataListeners.delete(listener)
  }

  /** 订阅设备列表变化，返回取消订阅函数 */
  onDevices(listener: DevicesListener): () => void {
    this.devicesListeners.add(listener)
    return () => this.devicesListeners.delete(listener)
  }

  /** 启动设备轮询（仅在列表变化时通知） */
  startWatch(intervalMs = 3000): void {
    if (this.watchTimer) return
    const tick = async (): Promise<void> => {
      try {
        const ports = await this.list()
        const signature = ports
          .map((port) => port.path)
          .sort()
          .join('|')
        if (signature !== this.lastSignature) {
          this.lastSignature = signature
          for (const listener of this.devicesListeners) listener(ports)
        }
      } catch (error) {
        logger.warn('[bp] device watch failed', error)
      }
    }
    this.watchTimer = setInterval(tick, intervalMs)
    // 立即执行一次
    void tick()
  }

  /** 停止设备轮询 */
  stopWatch(): void {
    if (this.watchTimer) {
      clearInterval(this.watchTimer)
      this.watchTimer = null
    }
  }
}

/** 单例：整个主进程共用（串口是独占资源） */
export const bpDevice = new BloodPressureDeviceManager()
