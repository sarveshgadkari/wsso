import { NextResponse } from 'next/server'
import { closeOpenSessionsPastMidnight } from '@/lib/time/auto-close'
import { runDueRecurringJobs } from '@/lib/actions/ops'

export const runtime = 'nodejs'

// Vercel Cron (vercel.json) — once per day (Hobby allows only daily jobs).
// Closes any open session that is already past local midnight in that person's timezone.
// On Pro you may change the schedule to `0 * * * *` for hourly catch-up.
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
    const recurring = await runDueRecurringJobs()
    return NextResponse.json({
      closed,
      recurring,
      message: `Closed ${closed} session(s). Created ${recurring} recurring work order(s).`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Auto-logout failed'
    console.error('[auto-logout]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
