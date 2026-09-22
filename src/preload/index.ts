import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  EVENT_CHANNELS,
  INVOKE_CHANNELS,
  isEventChannel,
  isInvokeChannel,
  type IpcContract,
  type IpcEvents
} from '../shared/ipc'

/**
 * 暴露给渲染进程的安全 API（白名单）。
 *
 * - 不直接暴露 `ipcRenderer`；
 * - 请求通道与事件通道均在共享层登记，并在运行时再次校验，防止越权调用；
 * - 类型由 `IpcContract` / `IpcEvents` 约束，渲染进程可获得完整类型提示。
 */
const api = {
  /** 请求-响应调用 */
  invoke<K extends keyof IpcContract>(
    channel: K,
    ...args: Parameters<IpcContract[K]>
  ): Promise<ReturnType<IpcContract[K]>> {
    if (!isInvokeChannel(String(channel))) {
      return Promise.reject(new Error(`Unsupported IPC channel: ${String(channel)}`))
    }
    return ipcRenderer.invoke(String(channel), ...args) as Promise<ReturnType<IpcContract[K]>>
  },

  /** 订阅主进程推送事件，返回取消订阅函数 */
  on<K extends keyof IpcEvents>(channel: K, listener: IpcEvents[K]): () => void {
    if (!isEventChannel(String(channel))) {
      throw new Error(`Unsupported IPC event: ${String(channel)}`)
    }
    const wrapped = (_event: IpcRendererEvent, ...args: unknown[]): void => {
      ;(listener as (...a: unknown[]) => void)(...args)
    }
    ipcRenderer.on(String(channel), wrapped)
    return () => ipcRenderer.removeListener(String(channel), wrapped)
  },

  /** 可用于调试/自检的通道清单 */
  channels: {
    invoke: INVOKE_CHANNELS,
    event: EVENT_CHANNELS
  }
}

export type RendererApi = typeof api

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  ;(window as unknown as { api: RendererApi }).api = api
}
