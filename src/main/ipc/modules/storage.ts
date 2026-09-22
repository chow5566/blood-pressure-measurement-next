import { BrowserWindow, dialog, shell } from 'electron'
import { handle, broadcast } from '../registry'
import { getDataDir } from '../../config'
import {
  ensureDataLayout,
  getStorageInfo,
  migrateDataDir,
  validateTargetDir
} from '../../infra/storage'
import type { MigrateProgress, StorageValidateResult } from '../../../shared/domain/storage'

/**
 * 存储相关 IPC：信息查询、目录选择、校验、迁移、打开目录。
 */
export function registerStorageIpc(): void {
  // 当前存储信息
  handle('storage:info', () => getStorageInfo())

  // 系统目录选择框
  handle('storage:choose-dir', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getAllWindows()[0]
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: '选择数据存储目录',
          properties: ['openDirectory', 'createDirectory']
        })
      : await dialog.showOpenDialog({
          title: '选择数据存储目录',
          properties: ['openDirectory', 'createDirectory']
        })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // 校验目标目录
  handle('storage:validate', (_event, target): Promise<StorageValidateResult> => {
    return validateTargetDir(target)
  })

  // 执行迁移（进度通过 storage:migrate-progress 推送）
  handle('storage:migrate', async (_event, target) => {
    const from = getDataDir()
    const onProgress = (progress: MigrateProgress): void => {
      broadcast('storage:migrate-progress', progress)
    }
    return migrateDataDir({ from, to: target, onProgress })
  })

  // 打开数据目录
  handle('storage:open-dir', async (_event, target) => {
    const dir = target && target.trim() ? target : getDataDir()
    ensureDataLayout(dir)
    const error = await shell.openPath(dir)
    if (error) {
      throw new Error(`打开目录失败：${error}`)
    }
  })
}
