import type { DriverStatus } from '@shared/domain/app'

/** 驱动管理 API */
export const driverApi = {
  status: (name: string): Promise<DriverStatus> => window.api.invoke('driver:status', name),
  install: (name: string): Promise<DriverStatus> => window.api.invoke('driver:install', name),
  uninstall: (name: string): Promise<DriverStatus> => window.api.invoke('driver:uninstall', name)
}
