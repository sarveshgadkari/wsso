import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { MyLeaveTable, type MyLeaveRow } from '@/components/leave/MyLeaveTable'

export const metadata = { title: 'My Leave — WSSO' }

export default async function LeavePage() {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const { data: requests } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('employee_id', profile.id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">My Leave</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Request time off and track approval status.
        </p>
      </div>

      <MyLeaveTable initialRequests={(requests ?? []) as MyLeaveRow[]} />
    </div>
  )
}
