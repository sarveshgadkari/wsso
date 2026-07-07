import type { DocBlock } from './types'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** One-time upgrade path: convert a legacy block-based page into HTML for the Tiptap editor. */
export function legacyBlocksToHtml(blocks: DocBlock[]): string {
  if (!blocks.length) return '<p></p>'

  const parts: string[] = []
  let listBuffer: { tag: 'ul' | 'ol'; items: string[] } | null = null

  const flushList = () => {
    if (!listBuffer) return
    parts.push(`<${listBuffer.tag}>${listBuffer.items.join('')}</${listBuffer.tag}>`)
    listBuffer = null
  }

  for (const block of blocks) {
    const text = escapeHtml(block.text)

    if (block.type === 'bullet' || block.type === 'numbered') {
      const tag = block.type === 'bullet' ? 'ul' : 'ol'
      if (listBuffer && listBuffer.tag !== tag) flushList()
      if (!listBuffer) listBuffer = { tag, items: [] }
      listBuffer.items.push(`<li>${text}</li>`)
      continue
    }

    flushList()

    switch (block.type) {
      case 'heading1': parts.push(`<h1>${text}</h1>`); break
      case 'heading2': parts.push(`<h2>${text}</h2>`); break
      case 'heading3': parts.push(`<h3>${text}</h3>`); break
      case 'todo':     parts.push(`<p>${block.checked ? '☑' : '☐'} ${text}</p>`); break
      case 'divider':  parts.push('<hr>'); break
      default:         parts.push(`<p>${text}</p>`)
    }
  }
  flushList()

  return parts.join('') || '<p></p>'
}
