import { ageFromBirthday } from '@shared/utils/format'
import { genderLabel } from './bscan-form'
import type { BScanReportParams } from '@shared/domain/b-scan'

export interface BScanReportForm {
  name?: string
  gender?: string
  birthday?: string
  barcode?: string
  diagnosis?: string
  diagnosisDetails?: string
}

/**
 * 构建报告参数（采集页与历史共用，避免走样）。
 * @param images 已选图片的图片来源（dataURL / 服务器地址），最多取 4 张
 */
export function buildBScanReportParams(options: {
  title: string
  form: BScanReportForm
  images: (string | null | undefined)[]
  doctorName?: string
  createTime?: string
}): BScanReportParams {
  const { title, form, images, doctorName, createTime } = options
  const age = ageFromBirthday(form.birthday)
  return {
    title,
    name: form.name,
    gender: genderLabel(form.gender),
    age: age === null ? '' : `${age}岁`,
    barcode: form.barcode,
    diagnosis: form.diagnosis,
    diagnosisDetails: form.diagnosisDetails,
    doctorName: doctorName ?? '',
    createTime: createTime ?? '',
    image1: images[0] || null,
    image2: images[1] || null,
    image3: images[2] || null,
    image4: images[3] || null
  }
}
