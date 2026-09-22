import type { UpdateStatus } from '@shared/domain/app'

/** 自动更新 API */
export const updateApi = {
  check: (): Promise<UpdateStatus> => window.api.invoke('update:check'),
  download: (): Promise<UpdateStatus> => window.api.invoke('update:download'),
  pause: (): Promise<UpdateStatus> => window.api.invoke('update:pause'),
  cancel: (): Promise<UpdateStatus> => window.api.invoke('update:cancel'),
  install: (): Promise<void> => window.api.invoke('update:install'),
  status: (): Promise<UpdateStatus> => window.api.invoke('update:status'),
  onStatus: (listener: (status: UpdateStatus) => void): (() => void) =>
    window.api.on('update:status', listener)
}
