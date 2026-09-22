import { app } from 'electron'
import { logger } from '../infra/logger'
import { bootLog } from '../infra/bootstrap-log'
import {
  buildBScanReport,
  deleteBScan,
  getBScan,
  listBScanTemplates,
  pageBScan,
  saveBScan
} from '../domain/b-scan/service'

/**
 * 开发自检：以真实代码路径验证 B超「保存 → 查询 → 报告 → 列表 → 删除」。
 * 仅在命令行带 `--self-test` 时执行（不打包使用）。
 */

const PNG_1x1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

export async function runSelfTest(): Promise<void> {
  const barcode = `SELFTEST-${Date.now()}`
  const result: Record<string, unknown> = { barcode }

  try {
    // 1) 保存（含一张图片）
    const save = await saveBScan({
      record: {
        barcode,
        checkType: 'GW',
        name: '自检用户',
        gender: '1',
        birthday: '1990-01-01',
        isNormal: '1',
        bodyParts: '2',
        diagnosis: '自检诊断',
        diagnosisDetails: '自检描述',
        isUpload: 'N'
      },
      images: [{ id: `img-${Date.now()}`, isCheck: 'Y', isUpload: 'N', base64Path: PNG_1x1 }],
      isUpload: 'N'
    })
    result.save = save

    // 2) 查询
    const detail = await getBScan(barcode)
    result.detail = {
      found: !!detail,
      name: detail?.name,
      images: detail?.images?.length ?? 0,
      imageHasBase64: !!detail?.images?.[0]?.base64Path
    }

    // 3) 列表
    const page = pageBScan({ pageNum: 1, pageSize: 5, keyword: barcode })
    result.page = { total: page.total, rows: page.rows.length }

    // 4) 报告
    const docx = await buildBScanReport({
      title: '自检报告',
      barcode,
      name: '自检用户',
      gender: '男',
      age: '36岁',
      diagnosis: '自检诊断',
      diagnosisDetails: '自检描述',
      doctorName: '系统',
      image1: PNG_1x1
    })
    result.report = { ok: docx.startsWith('data:'), length: docx.length }

    // 5) 模板
    result.templates = listBScanTemplates().length

    // 6) 删除
    result.remove = await deleteBScan([barcode])
    result.remaining = (await getBScan(barcode)) === null
  } catch (error) {
    result.error = (error as Error).message
  }

  logger.info('[self-test] result', result)
  bootLog('self-test result', result)
  app.exit(0)
}
