import * as docxPreview from 'docx-preview'
import html2canvas from 'html2canvas'

/**
 * 将 docx（dataURL）渲染为图片（jpeg dataURL）。
 * 用于报告预览：docx-preview 渲染到离屏 DOM，再用 html2canvas 转图。
 */
export async function wordToImage(docxDataUrl: string): Promise<string> {
  const docxBlob = base64UrlToBlob(docxDataUrl)

  // 离屏容器（移出可视区域，避免闪烁）
  const container = document.createElement('div')
  container.style.position = 'relative'
  container.style.zIndex = '999999'
  container.style.lineHeight = '1.5'
  container.style.marginLeft = '-9999999px'
  container.style.marginTop = '-9999999px'
  document.body.appendChild(container)

  try {
    await docxPreview.renderAsync(docxBlob, container, undefined, {
      className: 'scan-docx-preview'
    })

    const previewDom = container.querySelector('.scan-docx-preview')
    if (!previewDom) {
      throw new Error('报告渲染失败')
    }

    // 关键：等待报告中的图片全部加载完成，否则 html2canvas 截图时图片为空
    await waitForImages(previewDom as HTMLElement)
    await nextFrame()

    const canvas = await html2canvas(previewDom as HTMLElement, { scale: 2 })
    return canvas.toDataURL('image/jpeg')
  } finally {
    container.remove()
  }
}

/** 等待容器内所有 img 加载完成（或超时） */
async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve()
            return
          }
          const done = (): void => resolve()
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
          setTimeout(done, 3000)
        })
    )
  )
}

/** 等待两帧，确保布局/绘制完成 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

/** dataURL → Blob */
export function base64UrlToBlob(base64Url: string): Blob {
  const [meta, content] = base64Url.split(',')
  const mime = meta.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'
  const binary = atob(content)
  const length = binary.length
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

/**
 * 将本地图片（dataURL）转为 PNG dataURL。
 * docxtemplater-image-module-free 固定以 .png 写入，故报告图片必须为 PNG。
 * 非本地（http）地址或转换失败时原样返回（交由主进程处理）。
 */
export async function toPngDataUrl(src: string): Promise<string> {
  if (!src || src.startsWith('data:image/png')) return src
  if (!src.startsWith('data:image')) return src
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || 1
        canvas.height = img.naturalHeight || 1
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(src)
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(src)
      }
    }
    img.onerror = () => resolve(src)
    img.src = src
  })
}
