import { BrowserWindow } from 'electron'
import { handle } from '../registry'

/**
 * 窗口控制 IPC（无边框窗口的自定义最小化/最大化/关闭）。
 * 通过 event.sender 找到发起调用的窗口。
 */
export function registerWindowIpc(): void {
  const winOf = (sender: Electron.WebContents): BrowserWindow | null =>
    BrowserWindow.fromWebContents(sender)

  handle('window:minimize', (event) => {
    winOf(event.sender)?.minimize()
  })

  handle('window:toggle-maximize', (event) => {
    const win = winOf(event.sender)
    if (!win) return false
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
    return win.isMaximized()
  })

  handle('window:close', (event) => {
    winOf(event.sender)?.close()
  })

  handle('window:is-maximized', (event) => winOf(event.sender)?.isMaximized() ?? false)
}
