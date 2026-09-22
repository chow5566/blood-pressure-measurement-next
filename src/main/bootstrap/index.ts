import { initLogger, logger } from '../infra/logger'
import { bootLog } from '../infra/bootstrap-log'
import { ensureDataDir, getDataDir, resolveDataDir } from '../config'
import { initDatabase } from '../infra/database'
import { checkDataSpace, formatBytes, getStorageInfo } from '../infra/storage'
import { registerIpc } from '../ipc'
import { broadcast } from '../ipc/registry'
import { initBloodPressureBridge } from '../ipc/modules/blood-pressure'
import { initUpdater } from '../infra/update'

/**
 * 应用启动引导：按固定顺序初始化各子系统。
 * 顺序很重要：日志 → 数据目录 → 数据库 → IPC → 创建窗口。
 * 任一环节抛错都会中断启动，由调用方捕获并记录。
 */
export async function bootstrap(): Promise<void> {
  // 1) 日志（需在最前，后续所有步骤都可记录）
  initLogger()
  bootLog('logger initialized')

  // 2) 解析并准备数据目录（含旧目录探测）
  const dataDir = resolveDataDir()
  ensureDataDir(dataDir)
  bootLog('data dir resolved', { dataDir })

  // 3) 数据库（打开连接 + 执行迁移）
  const { file, applied } = initDatabase(dataDir)
  bootLog('database ready', { file, applied })

  // 4) 存储信息（顺带校验磁盘查询是否可用）
  try {
    const info = await getStorageInfo()
    logger.info('[storage] info', {
      dataDir: info.dataDir,
      used: formatBytes(info.usedBytes),
      free: info.drive ? formatBytes(info.drive.freeBytes) : 'unknown',
      isLocalDisk: info.drive?.isLocalDisk ?? null
    })
    bootLog('storage info', {
      used: formatBytes(info.usedBytes),
      free: info.drive ? formatBytes(info.drive.freeBytes) : 'unknown'
    })
  } catch (error) {
    logger.warn('[storage] query info failed', error)
  }

  // 5) IPC
  registerIpc()
  bootLog('ipc registered')

  // 6) 血压计桥接（解析设备数据并转推渲染进程 + 启动插拔轮询）
  initBloodPressureBridge()
  bootLog('blood pressure bridge initialized')

  // 7) 自动更新（仅绑定事件）
  initUpdater()
  bootLog('updater initialized')

  // 8) 磁盘空间定时检查（低空间预警）
  startSpaceWatch()

  // 9) 开发自检（--self-test）
  if (process.argv.includes('--self-test')) {
    const { runSelfTest } = await import('./self-test')
    await runSelfTest()
  }
}

/** 定时检查磁盘空间，低于预警阈值时通知渲染进程 */
function startSpaceWatch(intervalMs = 10 * 60 * 1000): void {
  const tick = async (): Promise<void> => {
    try {
      const check = await checkDataSpace()
      if (check.level !== 'ok') {
        broadcast('storage:low-space', {
          dataDir: getDataDir(),
          freeBytes: check.freeBytes,
          thresholdBytes: check.thresholdBytes
        })
      }
    } catch {
      // 忽略检查失败
    }
  }
  void tick()
  const timer = setInterval(tick, intervalMs)
  timer.unref?.()
}
