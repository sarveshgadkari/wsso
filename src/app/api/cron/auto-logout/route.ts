import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// Called by Vercel Cron (vercel.json) every 15 minutes.
// Finds any open time_log sessions older than 12 hours and closes them
// with closed_reason = 'auto_logout'.  The _trg_calc_duration trigger
// automatically computes duration_minutes from the timestamps.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()

  const { data: stale, error: fetchErr } = await supabaseAdmin
    .from('time_logs')
    .select('id, clock_in_at')
    .is('clock_out_at', null)
    .lt('clock_in_at', twelveHoursAgo)

  if (fetchErr) {
    console.error('[auto-logout] fetch error:', fetchErr.message)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!stale?.length) {
    return NextResponse.json({ closed: 0, message: 'No stale sessions.' })
  }

  let closed = 0
  for (const session of stale) {
    const autoClockOut = new Date(
      new Date(session.clock_in_at).getTime() + 12 * 60 * 60 * 1000,
    ).toISOString()

    const { error } = await supabaseAdmin
      .from('time_logs')
      .update({ clock_out_at: autoClockOut, closed_reason: 'auto_logout' })
      .eq('id', session.id)

    if (error) {
      console.error(`[auto-logout] failed to close session ${session.id}:`, error.message)
    } else {
      closed++
    }
  }

  console.log(`[auto-logout] closed ${closed} of ${stale.length} stale sessions`)
  return NextResponse.json({ closed, total: stale.length })
}
