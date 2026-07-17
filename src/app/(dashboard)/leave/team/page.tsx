import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { TeamLeaveTable, type TeamLeaveRow } from '@/components/leave/TeamLeaveTable'

export const metadata = { title: 'Team Leave — WSSO' }

export default async function TeamLeavePage() {
  const profile = await requireProfile()
  if (!['admin', 'manager'].includes(profile.role)) redirect('/dashboard')

  const supabase = await createClient()

  const { data: requests } = await supabase
    .from('leave_requests')
    .select('*, employee:profiles!leave_requests_employee_id_fkey(id, full_name, employee_code)')
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Team Leave</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {profile.role === 'manager'
            ? 'Leave requests from your team.'
            : 'Leave requests across all employees.'}
        </p>
      </div>

      <TeamLeaveTable initialRequests={(requests ?? []) as unknown as TeamLeaveRow[]} />
    </div>
  )
}
