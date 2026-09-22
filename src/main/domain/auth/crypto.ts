import CryptoJS from 'crypto-js'

/**
 * 密码加密（与旧项目一致的 AES-ECB-Pkcs7，密钥随 baseApi 变化）。
 * 后端接口不可修改，故保留该算法。
 */

/** 根据服务地址推导加密密钥（沿用旧项目规则） */
export function resolvePasswordKey(baseApi: string): string {
  return (baseApi ?? '').includes('alone') ? 'alone123xxxalone' : 'skzxscihealthsci'
}

/** 加密密码（输出 base64） */
export function encryptPassword(password: string, baseApi: string): string {
  const key = CryptoJS.enc.Utf8.parse(resolvePasswordKey(baseApi))
  const source = CryptoJS.enc.Utf8.parse(password)
  return CryptoJS.AES.encrypt(source, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7
  }).toString()
}
