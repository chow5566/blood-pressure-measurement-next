/** 窗口控制 API（无边框窗口） */
export const windowApi = {
  minimize: (): Promise<void> => window.api.invoke('window:minimize'),
  toggleMaximize: (): Promise<boolean> => window.api.invoke('window:toggle-maximize'),
  close: (): Promise<void> => window.api.invoke('window:close'),
  isMaximized: (): Promise<boolean> => window.api.invoke('window:is-maximized'),
  onMaximized: (listener: (isMaximized: boolean) => void): (() => void) =>
    window.api.on('window:maximized', listener)
}
