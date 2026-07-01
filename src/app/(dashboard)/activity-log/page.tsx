import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { ActivityLogFilters } from '@/components/activity-log/ActivityLogFilters'
import { ActivityLogTable, type ActivityLogEntry } from '@/components/activity-log/ActivityLogTable'

export const metadata = { title: 'Activity Log — WSSO' }

function isoDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

interface PageProps {
  searchParams: {
    from?:       string
    to?:         string
    employeeId?: string
    actionType?: string
  }
}

export default async function ActivityLogPage({ searchParams }: PageProps) {
  const profile  = await requireProfile()
  const supabase = await createClient()
  const canSeeTeam = ['admin', 'manager', 'director'].includes(profile.role)

  // Default: last 7 days
  const todayStr  = isoDateStr(new Date())
  const weekAgoStr = isoDateStr(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))

  const from       = searchParams.from       ?? weekAgoStr
  const to         = searchParams.to         ?? todayStr
  const employeeId = searchParams.employeeId ?? ''
  const actionType = searchParams.actionType ?? ''

  // ── Fetch activity logs with actor + tactic joins ─────────────────────────
  // RLS automatically scopes: admin/director → all; manager → team; employee → own
  let q = supabase
    .from('activity_logs')
    .select(`
      id, tactic_id, employee_id, action, hours_logged, notes, meta, created_at,
      actor:profiles!activity_logs_employee_id_fkey(id, full_name, employee_code),
      tactic:tactics!activity_logs_tactic_id_fkey(id, code, title)
    `)
    .gte('created_at', `${from}T00:00:00.000Z`)
    .lte('created_at', `${to}T23:59:59.999Z`)
    .order('created_at', { ascending: false })
    .limit(500)

  if (employeeId) q = q.eq('employee_id', employeeId)

  if      (actionType === 'created') q = q.eq('action', 'Tactic created')
  else if (actionType === 'updated') q = q.eq('action', 'Tactic updated')
  else if (actionType === 'status')  q = q.ilike('action', 'Status changed%')
  else if (actionType === 'hours')   q = q.ilike('action', 'Logged%')
  else if (actionType === 'system')  q = q.ilike('action', 'time_log%')

  const { data: raw } = await q

  // Cast to typed shape — Supabase returns nested joins as objects or null
  const logs = (raw ?? []) as unknown as ActivityLogEntry[]

  // ── Employee list for filter dropdown ─────────────────────────────────────
  let employees: { id: string; full_name: string; employee_code: string }[] = []
  if (canSeeTeam) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, employee_code')
      .eq('status', 'active')
      .order('full_name')
    employees = data ?? []
  }

  const scopeLabel = {
    admin:    'across the organisation',
    director: 'across the organisation',
    manager:  'across your team',
    employee: 'for your activity',
  }[profile.role] ?? ''

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Activity Log</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Work order and system audit trail {scopeLabel}.
        </p>
      </div>

      <ActivityLogFilters
        role={profile.role}
        employees={employees}
        defaultFrom={from}
        defaultTo={to}
        defaultEmployeeId={employeeId}
        defaultActionType={actionType}
      />

      <ActivityLogTable logs={logs} />
    </div>
  )
}
