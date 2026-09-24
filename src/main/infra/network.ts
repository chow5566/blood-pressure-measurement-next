import { net } from 'electron'
import { execFile } from 'node:child_process'

/** 系统网络状态探测（供 IPC 与业务服务复用） */

/** 是否联网（Electron net；异常时保守按在线处理） */
export function isOnline(): boolean {
  try {
    return net.isOnline()
  } catch {
    return true
  }
}

/** 读取 WiFi 连接状态、信号强度与 SSID（Windows：netsh；失败返回未连接） */
export function readWifi(): Promise<{
  connected: boolean
  signal: number | null
  ssid: string | null
}> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ connected: false, signal: null, ssid: null })
      return
    }
    // chcp 65001 强制 UTF-8，避免中文系统下 SSID 乱码；
    // 解析用 ASCII 锚点（SSID 标签 & 唯一百分数），不依赖本地化中文标签。
    execFile(
      'cmd',
      ['/c', 'chcp 65001>nul & netsh wlan show interfaces'],
      { windowsHide: true, timeout: 4000, encoding: 'utf-8' },
      (error, stdout) => {
        if (error || !stdout) {
          resolve({ connected: false, signal: null, ssid: null })
          return
        }
        const ssidMatch = /^\s*SSID\s*[:：]\s*(.+)$/m.exec(stdout)
        const signalMatch = /[:：]\s*(\d{1,3})\s*%/m.exec(stdout)
        const ssid = ssidMatch ? ssidMatch[1].trim() : ''
        const connected = ssid.length > 0
        resolve({
          connected,
          signal: connected && signalMatch ? Number(signalMatch[1]) : null,
          ssid: connected ? ssid : null
        })
      }
    )
  })
}
