import { handle } from '../registry'
import {
  buildBScanReport,
  changeBScanBarcode,
  clearBScanImages,
  deleteBScan,
  deleteBScanTemplate,
  getBScan,
  listBScanTemplates,
  pageBScan,
  saveBScan,
  saveBScanImages,
  saveBScanTemplate,
  syncPublicBScanTemplates,
  uploadBScanByBarcode
} from '../../domain/b-scan/service'
import { lookupOnlineBScan } from '../../domain/b-scan/online'

/**
 * B超 IPC：报告生成、记录保存/查询/删除/改条码、图片分批保存、上传、模板查询/维护、在线查询。
 */
export function registerBScanIpc(): void {
  handle('bscan:render-report', (_event, params) => buildBScanReport(params))
  handle('bscan:save', (_event, input) => saveBScan(input))
  handle('bscan:clear-images', (_event, barcode) => clearBScanImages(barcode))
  handle('bscan:save-images', (_event, barcode, images) => saveBScanImages(barcode, images))
  handle('bscan:get', (_event, barcode) => getBScan(barcode))
  handle('bscan:page-list', (_event, query) => pageBScan(query))
  handle('bscan:upload', (_event, input) => uploadBScanByBarcode(input))
  handle('bscan:delete', (_event, barcodes) => deleteBScan(barcodes))
  handle('bscan:change-barcode', (_event, oldBarcode, newBarcode) =>
    changeBScanBarcode(oldBarcode, newBarcode)
  )
  handle('bscan:templates', (_event, dataType, keyword) => listBScanTemplates(dataType, keyword))
  handle('bscan:template-save', (_event, template) => saveBScanTemplate(template))
  handle('bscan:template-delete', (_event, id) => deleteBScanTemplate(id))
  handle('bscan:template-sync', () => syncPublicBScanTemplates())
  handle('bscan:online-lookup', (_event, barcode, type) => lookupOnlineBScan(barcode, type))
}
