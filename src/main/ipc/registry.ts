import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { EventChannel, IpcContract, IpcEvents, InvokeChannel } from '../../shared/ipc'

/**
 * 类型化 IPC 注册中心。
 * - `handle`：注册请求-响应通道，入参与返回值自动按 IpcContract 约束。
 * - `broadcast`：向所有窗口推送事件，按 IpcEvents 约束。
 */

type MaybePromise<T> = T | Promise<T>

/** 请求处理函数签名（额外提供 event 便于取 sender） */
export type IpcHandler<K extends InvokeChannel> = (
  event: IpcMainInvokeEvent,
  ...args: Parameters<IpcContract[K]>
) => MaybePromise<ReturnType<IpcContract[K]>>

/** 注册一个请求-响应通道 */
export function handle<K extends InvokeChannel>(channel: K, handler: IpcHandler<K>): void {
  ipcMain.handle(channel, (event, ...args) =>
    handler(event, ...(args as Parameters<IpcContract[K]>))
  )
}

/** 向所有窗口推送事件 */
export function broadcast<K extends EventChannel>(
  channel: K,
  ...args: Parameters<IpcEvents[K]>
): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }
}
