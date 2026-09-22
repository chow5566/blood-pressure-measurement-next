import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'

/**
 * 窗口管理（无边框 + 自定义控件）。
 *
 * 体验与性能要点：
 * - 单窗口架构：弹层走应用内组件，避免反复创建 BrowserWindow（ADR-013）。
 * - `show:false` + `ready-to-show`：首帧就绪后再显示，避免白屏。
 * - `backgroundColor`：与页面背景一致，即使提前显示也不闪白。
 */
export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())

  // 最大化状态变化推送给渲染层（用于切换按钮图标）
  const notifyMaximized = (): void => {
    if (!win.isDestroyed()) {
      win.webContents.send('window:maximized', win.isMaximized())
    }
  }
  win.on('maximize', notifyMaximized)
  win.on('unmaximize', notifyMaximized)

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
