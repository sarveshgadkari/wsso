import { NextResponse } from 'next/server'
import { getOrganization, getProfile } from '@/lib/auth/session'
import { mergeWorkspaceSettings } from '@/lib/workspace/settings'
import { answerHelpQuestion } from '@/lib/help/answer'
import { buildChatKnowledge, toHelpRole } from '@/lib/help/scope'

const WINDOW_MS = 60_000
const MAX_HITS = 40
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
    return NextResponse.json({ error: 'Too many questions. Wait a minute and try again.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rec = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const message = typeof rec.message === 'string' ? rec.message.trim() : ''
  const path = typeof rec.path === 'string' ? rec.path : '/dashboard'

  if (message.length < 1) {
    return NextResponse.json({ error: 'Type or speak a question about WSSO.' }, { status: 400 })
  }
  if (message.length > 1000) {
    return NextResponse.json({ error: 'Keep questions under 1000 characters.' }, { status: 400 })
  }

  const org = await getOrganization(profile.organization_id)
  const features = mergeWorkspaceSettings(org?.settings).features
  const { current, allowed } = buildChatKnowledge(role, features, path)

  const reply = answerHelpQuestion({
    message,
    role,
    features,
    current,
    allowed,
  })

  return NextResponse.json({ reply })
}
