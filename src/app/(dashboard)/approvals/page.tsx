import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { ApprovalsInbox } from '@/components/ops/ApprovalsInbox'
import { listCatalog } from '@/lib/actions/workspace'

export const metadata = { title: 'Approvals — WSSO' }

export default async function ApprovalsPage() {
  const profile = await requireProfile()
  if (!['admin', 'manager'].includes(profile.role)) redirect('/dashboard')

  const supabase = await createClient()
  const [leaveRes, notesRes, types] = await Promise.all([
    supabase
      .from('leave_requests')
      .select('*, employee:profiles!leave_requests_employee_id_fkey(id, full_name, employee_code, backup_approver_id)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('time_logs')
      .select(`
        id, log_date, clock_in_note, clock_in_note_status, clock_out_note, clock_out_note_status,
        employee:profiles!time_logs_employee_id_fkey(id, full_name, employee_code)
      `)
      .or('clock_in_note_status.eq.pending,clock_out_note_status.eq.pending')
      .order('log_date', { ascending: false }),
    listCatalog('leave_type'),
  ])

  const leaveTypeLabel = Object.fromEntries(types.map((t) => [t.id, t.label]))

  const notes: {
    timeLogId: string
    employeeName: string
    employeeCode: string
    logDate: string
    field: 'clock_in' | 'clock_out'
    note: string
  }[] = []
  for (const l of notesRes.data ?? []) {
    const emp = l.employee as unknown as { id: string; full_name: string; employee_code: string } | null
    if (!emp) continue
    if (l.clock_in_note_status === 'pending' && l.clock_in_note) {
      notes.push({
        timeLogId: l.id, employeeName: emp.full_name, employeeCode: emp.employee_code,
        logDate: l.log_date, field: 'clock_in', note: l.clock_in_note,
      })
    }
    if (l.clock_out_note_status === 'pending' && l.clock_out_note) {
      notes.push({
        timeLogId: l.id, employeeName: emp.full_name, employeeCode: emp.employee_code,
        logDate: l.log_date, field: 'clock_out', note: l.clock_out_note,
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Approvals</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Leave and clock notes in one place. Approve or reject without switching screens.
        </p>
      </div>
      <ApprovalsInbox
        leave={(leaveRes.data ?? []) as never}
        notes={notes}
        leaveTypeLabel={leaveTypeLabel}
      />
    </div>
  )
}
