import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { getToken } from '../config'
import type { WindowMode } from '../../shared/domain/app'

/**
 * 窗口管理（无边框 + 自定义控件）。
 *
 * 体验与性能要点：
 * - 单窗口架构：弹层走应用内组件，避免反复创建 BrowserWindow（ADR-013）。
 * - `show:false` + `ready-to-show`：首帧就绪后再显示，避免白屏。
 * - `backgroundColor`：与页面背景一致，即使提前显示也不闪白。
 * - 登录时切换为「小窗、锁定尺寸」，进入应用后恢复大窗（见 applyWindowMode）。
 */

/** 登录小窗尺寸（约一个表单卡片大小） */
const LOGIN_SIZE = { width: 400, height: 540 }
/** 主应用窗口尺寸 */
const MAIN_SIZE = { width: 1280, height: 820 }
/** 主应用窗口最小尺寸 */
const MAIN_MIN = { width: 1080, height: 700 }

/** 切换窗口模式（登录小窗 / 主应用大窗） */
export function applyWindowMode(win: BrowserWindow, mode: WindowMode): void {
  if (!win || win.isDestroyed()) return
  if (mode === 'login') {
    if (win.isMaximized()) win.unmaximize()
    win.setResizable(false)
    win.setMaximizable(false)
    win.setMinimumSize(LOGIN_SIZE.width, LOGIN_SIZE.height)
    win.setMaximumSize(LOGIN_SIZE.width, LOGIN_SIZE.height)
    win.setSize(LOGIN_SIZE.width, LOGIN_SIZE.height)
    win.center()
  } else {
    win.setMaximumSize(0, 0)
    win.setMinimumSize(MAIN_MIN.width, MAIN_MIN.height)
    win.setResizable(true)
    win.setMaximizable(true)
    win.setSize(MAIN_SIZE.width, MAIN_SIZE.height)
    win.center()
  }
}

export function createMainWindow(): BrowserWindow {
  const mode: WindowMode = getToken() ? 'main' : 'login'
  const size = mode === 'login' ? LOGIN_SIZE : MAIN_SIZE
  const minSize = mode === 'login' ? LOGIN_SIZE : MAIN_MIN

  const win = new BrowserWindow({
    width: size.width,
    height: size.height,
    minWidth: minSize.width,
    minHeight: minSize.height,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    resizable: mode === 'main',
    maximizable: mode === 'main',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 登录模式锁定尺寸
  if (mode === 'login') {
    win.setMaximumSize(LOGIN_SIZE.width, LOGIN_SIZE.height)
  }

  win.on('ready-to-show', () => {
    win.center()
    win.show()
  })

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
