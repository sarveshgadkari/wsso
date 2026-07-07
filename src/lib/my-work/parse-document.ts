import mammoth from 'mammoth'
import type { DocBlock, DocBlockType } from './types'

function newBlockId(): string {
  return crypto.randomUUID()
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

/** Very small block-level HTML splitter — good enough for mammoth's plain output. */
function htmlToBlocks(html: string): DocBlock[] {
  const blocks: DocBlock[] = []
  const tagRe = /<(h1|h2|h3|p|li|hr)\b[^>]*>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi
  let match: RegExpExecArray | null

  while ((match = tagRe.exec(html))) {
    const tag  = (match[1] ?? 'hr').toLowerCase()
    const text = stripTags(match[2] ?? '')

    if (tag === 'hr') {
      blocks.push({ id: newBlockId(), type: 'divider', text: '' })
      continue
    }
    if (!text) continue

    const type: DocBlockType =
      tag === 'h1' ? 'heading1' :
      tag === 'h2' ? 'heading2' :
      tag === 'h3' ? 'heading3' :
      tag === 'li' ? 'bullet'   : 'paragraph'

    blocks.push({ id: newBlockId(), type, text })
  }

  return blocks
}

function textToBlocks(text: string): DocBlock[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => ({ id: newBlockId(), type: 'paragraph' as DocBlockType, text: p }))
}

/** Parse an uploaded .docx or .txt file into Notion-style document blocks. */
export async function parseDocumentBuffer(buffer: ArrayBuffer, filename: string): Promise<DocBlock[]> {
  const isDocx = /\.docx$/i.test(filename)
  let blocks: DocBlock[]

  if (isDocx) {
    const { value: html } = await mammoth.convertToHtml({ buffer: Buffer.from(buffer) })
    blocks = htmlToBlocks(html)
  } else {
    const text = Buffer.from(buffer).toString('utf-8')
    blocks = textToBlocks(text)
  }

  return blocks.length ? blocks : [{ id: newBlockId(), type: 'paragraph', text: '' }]
}
