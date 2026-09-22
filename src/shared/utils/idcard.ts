/** 身份证解析（沿用旧实现规则：18 位，末位校验 X） */

export interface IdCardInfo {
  age: number
  /** '1' 男 / '2' 女 */
  gender: '1' | '2'
  /** YYYY-MM-DD */
  birthDate: string
}

const ID_CARD_REGEX =
  /^[1-9]\d{5}(19|20)\d{2}((0[1-9])|(10|11|12))(([0-2][1-9])|10|20|30|31)\d{3}(\d|X|x)$/

/** 解析身份证；非法返回 null */
export function parseIDCard(id: string | null | undefined): IdCardInfo | null {
  if (!id || !ID_CARD_REGEX.test(id)) return null

  const birthYear = id.substring(6, 10)
  const birthMonth = id.substring(10, 12)
  const birthDate = id.substring(12, 14)
  const age = new Date().getFullYear() - Number(birthYear)
  const gender: '1' | '2' = Number(id.charAt(16)) % 2 === 0 ? '2' : '1'

  return { age, gender, birthDate: `${birthYear}-${birthMonth}-${birthDate}` }
}
