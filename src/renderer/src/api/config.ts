import type { RuntimeConfig, RuntimeConfigPatch } from '@shared/domain/app'

/** 运行时配置 API */
export const configApi = {
  get: (): Promise<RuntimeConfig> => window.api.invoke('config:get'),
  update: (patch: RuntimeConfigPatch): Promise<RuntimeConfig> =>
    window.api.invoke('config:update', patch)
}
