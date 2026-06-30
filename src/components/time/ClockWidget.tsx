import { getProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { ClockWidgetUI } from './ClockWidgetUI'

// Server component — fetches the current user's open session then renders the
// interactive client widget. Import this in any page that needs the clock.
export async function ClockWidget() {
  const profile = await getProfile()
  if (!profile) return null

  const supabase = await createClient()
  const { data: session } = await supabase
    .from('time_logs')
    .select('*')
    .eq('employee_id', profile.id)
    .is('clock_out_at', null)
    .maybeSingle()

  return <ClockWidgetUI initialSession={session ?? null} />
}
