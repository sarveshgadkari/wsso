import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth/session'
import { toHelpRole } from '@/lib/help/scope'

export const runtime = 'nodejs'

const WINDOW_MS = 60_000
const MAX_HITS = 20
const MAX_BYTES = 4 * 1024 * 1024
const hits = new Map<string, { count: number; resetAt: number }>()

function allowRequest(userId: string): boolean {
  const now = Date.now()
  const row = hits.get(userId)
  if (!row || now > row.resetAt) {
    hits.set(userId, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (row.count >= MAX_HITS) return false
  row.count += 1
  return true
}

function whisperEndpoint(): { url: string; key: string; model: string } | null {
  const groq = process.env.GROQ_API_KEY
  if (groq) {
    return {
      url: 'https://api.groq.com/openai/v1/audio/transcriptions',
      key: groq,
      model: 'whisper-large-v3-turbo',
    }
  }
  const openai = process.env.OPENAI_API_KEY
  if (openai) {
    return {
      url: 'https://api.openai.com/v1/audio/transcriptions',
      key: openai,
      model: 'whisper-1',
    }
  }
  return null
}

export async function POST(request: Request) {
  const profile = await getProfile()
  if (!profile || profile.status === 'inactive') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = toHelpRole(profile.role)
  if (!role) {
    return NextResponse.json({ error: 'Help is not available for this account.' }, { status: 403 })
  }

  if (!allowRequest(profile.id)) {
    return NextResponse.json({ error: 'Too many voice requests. Wait a minute and try again.' }, { status: 429 })
  }

  const endpoint = whisperEndpoint()
  if (!endpoint) {
    return NextResponse.json({ error: 'Server transcription is not configured' }, { status: 501 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid audio upload' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File) || file.size < 200) {
    return NextResponse.json({ error: 'Could not hear that. Try again, or type.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Voice clip is too long. Ask a shorter question.' }, { status: 413 })
  }

  const outbound = new FormData()
  outbound.append('file', file, file.name || 'help-voice.webm')
  outbound.append('model', endpoint.model)
  outbound.append('language', 'en')
  outbound.append('response_format', 'json')

  const res = await fetch(endpoint.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${endpoint.key}` },
    body: outbound,
  })

  const json = (await res.json().catch(() => ({}))) as { text?: string; error?: { message?: string } }
  if (!res.ok) {
    console.error('[help/transcribe] provider failed:', res.status, json.error?.message)
    return NextResponse.json({ error: 'Could not transcribe that. Try again, or type.' }, { status: 502 })
  }

  const text = typeof json.text === 'string' ? json.text.trim() : ''
  return NextResponse.json({ text })
}
