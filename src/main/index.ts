import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { logger } from './infra/logger'
import { createMainWindow } from './infra/window-manager'
import { bootLog } from './infra/bootstrap-log'
import { bootstrap } from './bootstrap'
import { disposeBloodPressure } from './ipc/modules/blood-pressure'
import { getRenderMode } from './config'

bootLog('main entry', { argv: process.argv.slice(1), packaged: app.isPackaged })

// 软件渲染模式（Win7 GPU 兼容排障）：必须在 app ready 前设置
try {
  if (getRenderMode() === 'software') {
    app.disableHardwareAcceleration()
    bootLog('hardware acceleration disabled (software mode)')
  }
} catch {
  // 配置尚未可用时忽略
}

// 退出前释放串口与设备轮询
app.on('before-quit', () => {
  void disposeBloodPressure()
})

// 兜底错误处理：记录未捕获异常，避免静默崩溃
process.on('uncaughtException', (error) => {
  bootLog('uncaughtException', { message: error.message, stack: error.stack })
  logger.error('[main] uncaughtException', error)
})
process.on('unhandledRejection', (reason) => {
  bootLog('unhandledRejection', { reason: String(reason) })
  logger.error('[main] unhandledRejection', reason)
})
app.on('render-process-gone', (_event, _contents, details) => {
  logger.error('[main] render-process-gone', details)
})
app.on('child-process-gone', (_event, details) => {
  logger.warn('[main] child-process-gone', details)
})

// Win7 沙箱兼容：禁用 sandbox（见 docs/02-compatibility.md §7）
app.commandLine.appendSwitch('no-sandbox')

// 禁止多开
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  bootLog('another instance is running, quit')
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(async () => {
    try {
      await bootstrap()
      electronApp.setAppUserModelId('com.skzx.blood-pressure-measurement')

      app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
      })

      createMainWindow()
      bootLog('main window created')
    } catch (error) {
      bootLog('bootstrap failed', {
        message: (error as Error)?.message,
        stack: (error as Error)?.stack
      })
      logger.error('bootstrap failed', error)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
