'use client'

import { audioFileName } from '@/lib/help/mic-record'
import { transcribeInBrowser } from '@/lib/help/transcribe-browser'

export async function transcribeAudio(blob: Blob): Promise<string> {
  const form = new FormData()
  form.append('file', blob, audioFileName(blob.type))

  try {
    const res = await fetch('/api/help/transcribe', { method: 'POST', body: form })
    const json = (await res.json().catch(() => ({}))) as { text?: string }
    if (res.ok && json.text?.trim()) return json.text.trim()
  } catch {
    /* Firefox / Safari fall back to on-device Whisper */
  }

  return transcribeInBrowser(blob)
}
