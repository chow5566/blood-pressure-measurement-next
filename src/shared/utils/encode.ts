/**
 * 服务端约定的 Base64 编码（UTF-8 安全）。
 * 与旧项目 utils.encode64 行为一致，后端接口不可修改，故保留该实现。
 */

const KEY_STR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='

/** 将字符串按 UTF-8 转为二进制字符串 */
function utf8Encode(input: string): string {
  const copy = input.replace(/\r\n/g, '\n')
  let utfText = ''
  for (let n = 0; n < copy.length; n++) {
    const c = copy.charCodeAt(n)
    if (c < 128) {
      utfText += String.fromCharCode(c)
    } else if (c > 127 && c < 2048) {
      utfText += String.fromCharCode((c >> 6) | 192)
      utfText += String.fromCharCode((c & 63) | 128)
    } else {
      utfText += String.fromCharCode((c >> 12) | 224)
      utfText += String.fromCharCode(((c >> 6) & 63) | 128)
      utfText += String.fromCharCode((c & 63) | 128)
    }
  }
  return utfText
}

/** UTF-8 安全的 Base64 编码（服务端 dataContent 使用） */
export function encode64(input: string): string {
  const copy = utf8Encode(input)
  let output = ''
  let i = 0
  while (i < copy.length) {
    const chr1 = copy.charCodeAt(i++)
    const chr2 = copy.charCodeAt(i++)
    const chr3 = copy.charCodeAt(i++)

    const enc1 = chr1 >> 2
    const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4)
    let enc3 = ((chr2 & 15) << 2) | (chr3 >> 6)
    let enc4 = chr3 & 63

    if (Number.isNaN(chr2)) {
      enc3 = 64
      enc4 = 64
    } else if (Number.isNaN(chr3)) {
      enc4 = 64
    }

    output +=
      KEY_STR.charAt(enc1) + KEY_STR.charAt(enc2) + KEY_STR.charAt(enc3) + KEY_STR.charAt(enc4)
  }
  return output
}
