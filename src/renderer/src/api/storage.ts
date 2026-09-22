import type {
  StorageInfo,
  StorageValidateResult,
  MigrateResult,
  MigrateProgress,
  LowSpaceInfo
} from '@shared/domain/storage'

/** 存储与迁移 API 封装 */
export const storageApi = {
  /** 当前存储信息 */
  info: (): Promise<StorageInfo> => window.api.invoke('storage:info'),
  /** 打开系统目录选择框 */
  chooseDir: (): Promise<string | null> => window.api.invoke('storage:choose-dir'),
  /** 校验目标目录 */
  validate: (target: string): Promise<StorageValidateResult> =>
    window.api.invoke('storage:validate', target),
  /** 执行迁移（成功会自动重启） */
  migrate: (target: string): Promise<MigrateResult> => window.api.invoke('storage:migrate', target),
  /** 打开数据目录 */
  openDir: (target?: string): Promise<void> => window.api.invoke('storage:open-dir', target),
  /** 订阅迁移进度，返回取消订阅函数 */
  onProgress: (listener: (progress: MigrateProgress) => void): (() => void) =>
    window.api.on('storage:migrate-progress', listener),
  /** 订阅低空间预警，返回取消订阅函数 */
  onLowSpace: (listener: (info: LowSpaceInfo) => void): (() => void) =>
    window.api.on('storage:low-space', listener)
}
