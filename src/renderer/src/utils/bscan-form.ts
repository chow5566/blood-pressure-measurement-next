import { BSCAN_BODY_PARTS } from '@shared/domain/b-scan'

/** 性别显示（'1' 男 / '2' 女） */
export function genderLabel(value?: string | null): string {
  if (value === '1') return '男'
  if (value === '2') return '女'
  return ''
}

/** 检查结果显示（'1' 正常 / '2' 异常） */
export function isNormalLabel(value?: string | null): string {
  return value === '2' ? '异常' : '正常'
}

/** 检查部位显示 */
export function bodyPartsLabel(value?: string | null): string {
  return BSCAN_BODY_PARTS.find((item) => item.value === value)?.label ?? '-'
}

/** B超表单校验规则（采集页与历史编辑共用，避免走样） */
export const BSCAN_FORM_RULES = {
  barcode: [{ required: true, message: '请输入条码号', trigger: 'blur' as const }],
  isNormal: [{ required: true, message: '请选择检查结果', trigger: 'change' as const }],
  bodyParts: [{ required: true, message: '请选择检测部位', trigger: 'change' as const }],
  diagnosis: [{ required: true, message: '请输入诊断结果', trigger: 'blur' as const }],
  diagnosisDetails: [{ required: true, message: '请输入诊断描述', trigger: 'blur' as const }]
}
