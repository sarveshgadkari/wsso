import mammoth from 'mammoth'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function textToHtml(text: string): string {
  const paragraphs = text
    .split(/\r?\n\s*\r?\n/)
    .map(p => p.trim())
    .filter(Boolean)

  if (!paragraphs.length) return '<p></p>'
  return paragraphs.map(p => `<p>${escapeHtml(p).replace(/\r?\n/g, '<br>')}</p>`).join('')
}

/** Parse an uploaded .docx or .txt file into rich-text HTML for the Tiptap editor. */
export async function parseDocumentBuffer(buffer: ArrayBuffer, filename: string): Promise<string> {
  const isDocx = /\.docx$/i.test(filename)

  if (isDocx) {
    const { value: html } = await mammoth.convertToHtml({ buffer: Buffer.from(buffer) })
    return html.trim() || '<p></p>'
  }

  return textToHtml(Buffer.from(buffer).toString('utf-8'))
}
