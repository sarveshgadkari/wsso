import { NextResponse } from 'next/server'
import { closeOpenSessionsPastMidnight } from '@/lib/time/auto-close'

export const runtime = 'nodejs'

// Vercel Cron (vercel.json) — hourly so each employee's local midnight is caught.
// Closes open sessions at 00:00 in that person's timezone, never more than 24 hours.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const closed = await closeOpenSessionsPastMidnight()
    return NextResponse.json({ closed, message: closed ? `Closed ${closed} session(s) at local midnight.` : 'No sessions past local midnight.' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Auto-logout failed'
    console.error('[auto-logout]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
