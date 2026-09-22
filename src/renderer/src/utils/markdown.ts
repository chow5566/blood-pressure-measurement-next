/** 极简 Markdown 渲染（仅用于更新说明：标题 / 列表 / 粗体 / 行内代码 / 链接） */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
    )
}

/** 将 Markdown 文本渲染为安全 HTML 字符串 */
export function renderMarkdown(markdown: string): string {
  if (!markdown) return ''
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let html = ''
  let inList = false

  const closeList = (): void => {
    if (inList) {
      html += '</ul>'
      inList = false
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      closeList()
      html += `<h4 class="md__h">${inline(heading[2])}</h4>`
      continue
    }
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line)
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || ordered) {
      if (!inList) {
        html += '<ul class="md__ul">'
        inList = true
      }
      html += `<li>${inline((bullet ?? ordered)![1])}</li>`
      continue
    }
    if (!line.trim()) {
      closeList()
      continue
    }
    closeList()
    html += `<p class="md__p">${inline(line)}</p>`
  }
  closeList()
  return html
}
