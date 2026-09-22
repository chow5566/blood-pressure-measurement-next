import { join } from 'node:path'

/**
 * 数据目录布局（详见 docs/10-storage-and-migration.md §3）：
 *
 * <dataDir>/
 * ├─ database/   SQLite 主库
 * ├─ images/     B超原始采集图（按条码分目录）
 * ├─ reports/    生成的报告图
 * └─ temp/       临时文件（迁移/导出中转）
 */
export const DATA_SUB_DIRS = ['database', 'images', 'reports', 'temp'] as const
export type DataSubDir = (typeof DATA_SUB_DIRS)[number]

/** 数据子目录绝对路径 */
export function subDir(dataDir: string, name: DataSubDir): string {
  return join(dataDir, name)
}

/** 数据库目录 */
export function databaseDir(dataDir: string): string {
  return subDir(dataDir, 'database')
}

/** 图片目录 */
export function imagesDir(dataDir: string): string {
  return subDir(dataDir, 'images')
}

/** 报告目录 */
export function reportsDir(dataDir: string): string {
  return subDir(dataDir, 'reports')
}

/** 临时目录 */
export function tempDir(dataDir: string): string {
  return subDir(dataDir, 'temp')
}

/** 某条码的图片目录 */
export function imagesDirOfBarcode(dataDir: string, barcode: string): string {
  return join(imagesDir(dataDir), sanitizeSegment(barcode))
}

/** 是否位于数据目录内部（用于防止把目标目录选成数据目录的子目录） */
export function isInside(parent: string, child: string): boolean {
  const normalizedParent = normalize(parent)
  const normalizedChild = normalize(child)
  return (
    normalizedChild === normalizedParent ||
    normalizedChild.startsWith(normalizedParent + '\\') ||
    normalizedChild.startsWith(normalizedParent + '/')
  )
}

/** 路径归一化：统一分隔符、去尾部斜杠、小写盘符比较由调用方决定 */
function normalize(value: string): string {
  return value.replace(/[\\/]+/g, '\\').replace(/\\+$/, '')
}

/** 过滤文件名中的非法字符（条码号可能含 / : 等） */
export function sanitizeSegment(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_')
}
