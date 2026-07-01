import Link from 'next/link'
import { Users, ListTodo, Loader, AlertCircle, Clock, ChevronRight, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { WeeklyChart, type DayBar } from '@/components/time/WeeklyChart'
import { StatCard } from './StatCard'
import { isoDate, last7Days, daysAgo, dayLabel, startOfWeekISO } from '@/lib/utils/dates'

interface TeamMemberRow {
  id:            string
  full_name:     string
  employee_code: string
  todayMinutes:  number
  weekMinutes:   number
  openCount:     number
}

interface ReviewTacticRow {
  id:       string
  code:     string
  title:    string
  priority: string
  assignee: { full_name: string } | null
}

export async function ManagerDashboard() {
  const supabase   = await createClient()
  const today      = isoDate()
  const weekStart  = startOfWeekISO()
  const sevenAgo   = daysAgo(7)

  // All queries use the regular client — RLS auto-scopes to manager's team
  const [
    teamRes,
    openRes,
    inProgressRes,
    overdueRes,
    reviewRes,
    teamMembersRes,
    timeLogsRes,
    hoursLogsRes,
    tacticDocsRes,
  ] = await Promise.all([
    supabase.from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase.from('tactics')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'assigned'),
    supabase.from('tactics')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'in_progress'),
    supabase.from('tactics')
      .select('*', { count: 'exact', head: true })
      .lt('due_date', today)
      .neq('status', 'done')
      .neq('status', 'archived'),
    supabase.from('tactics')
      .select(`
        id, code, title, priority,
        assignee:profiles!tactics_assigned_to_fkey(full_name)
      `)
      .eq('status', 'review'),
    // Team members for the table
    supabase.from('profiles')
      .select('id, full_name, employee_code')
      .eq('status', 'active'),
    // Today's time logs per employee
    supabase.from('time_logs')
      .select('employee_id, log_date, duration_minutes')
      .gte('log_date', weekStart)
      .not('duration_minutes', 'is', null),
    // Team hours per day last 7 days (for chart)
    supabase.from('time_logs')
      .select('log_date, duration_minutes')
      .gte('log_date', isoDate(sevenAgo))
      .not('duration_minutes', 'is', null),
    // TACTIC docs submitted by team employees awaiting Manager review
    supabase
      .from('tactic_documents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'submitted'),
  ])

  // Open tactics per team member
  const { data: openTactics } = await supabase
    .from('tactics')
    .select('assigned_to')
    .in('status', ['assigned', 'in_progress'])

  const openByEmployee: Record<string, number> = {}
  ;(openTactics ?? []).forEach((t: { assigned_to: string }) => {
    openByEmployee[t.assigned_to] = (openByEmployee[t.assigned_to] ?? 0) + 1
  })

  // Build per-employee time stats from time_logs
  const todayMinByEmployee: Record<string, number> = {}
  const weekMinByEmployee:  Record<string, number> = {}
  ;(timeLogsRes.data ?? []).forEach((l: { employee_id: string; log_date: string; duration_minutes: number | null }) => {
    if (!l.duration_minutes) return
    weekMinByEmployee[l.employee_id] = (weekMinByEmployee[l.employee_id] ?? 0) + l.duration_minutes
    if (l.log_date === today) {
      todayMinByEmployee[l.employee_id] = (todayMinByEmployee[l.employee_id] ?? 0) + l.duration_minutes
    }
  })

  const teamMembers: TeamMemberRow[] = ((teamMembersRes.data ?? []) as { id: string; full_name: string; employee_code: string }[]).map(m => ({
    id:            m.id,
    full_name:     m.full_name,
    employee_code: m.employee_code,
    todayMinutes:  todayMinByEmployee[m.id] ?? 0,
    weekMinutes:   weekMinByEmployee[m.id]  ?? 0,
    openCount:     openByEmployee[m.id]     ?? 0,
  }))

  // Team hours chart — aggregate all members per day
  const hoursByDate: Record<string, number> = {}
  ;(hoursLogsRes.data ?? []).forEach((l: { log_date: string; duration_minutes: number | null }) => {
    if (l.log_date && l.duration_minutes) {
      hoursByDate[l.log_date] = (hoursByDate[l.log_date] ?? 0) + l.duration_minutes
    }
  })
  const hoursData: DayBar[] = last7Days().map(date => ({
    label: dayLabel(date),
    date,
    hours: Math.round(((hoursByDate[date] ?? 0) / 60) * 10) / 10,
  }))

  const reviewTactics = (reviewRes.data ?? []) as unknown as ReviewTacticRow[]

  function fmtHours(minutes: number): string {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard label="Team size"   value={teamRes.count        ?? 0} icon={Users} />
        <StatCard label="Open"        value={openRes.count        ?? 0} sub="assigned"   icon={ListTodo} />
        <StatCard label="In Progress" value={inProgressRes.count  ?? 0}                  icon={Loader} />
        <StatCard
          label="Overdue"
          value={overdueRes.count ?? 0}
          sub="need attention"
          variant={(overdueRes.count ?? 0) > 0 ? 'danger' : 'default'}
          icon={AlertCircle}
        />
        <StatCard
          label="TACTICs pending"
          value={tacticDocsRes.count ?? 0}
          sub="awaiting your review"
          variant={(tacticDocsRes.count ?? 0) > 0 ? 'warning' : 'default'}
          icon={FileText}
        />
      </div>

      {/* Review queue + hours chart */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Pending review */}
        <div className="card">
          <div className="flex items-center gap-2 border-b border-neutral-200 px-5 py-3">
            <Clock className="h-4 w-4 text-primary-500" />
            <h3 className="text-sm font-semibold text-neutral-700">Needs your approval</h3>
            <span className="ml-auto rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
              {reviewTactics.length}
            </span>
          </div>
          {reviewTactics.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-neutral-400">All clear — no tasks pending review</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {reviewTactics.map(t => (
                <li key={t.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-800">{t.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      <span className="font-mono">{t.code}</span>
                      {t.assignee && <> · {t.assignee.full_name}</>}
                    </p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    <Link
                      href={`/tactics/${t.id}`}
                      className="flex items-center gap-0.5 text-xs text-primary-600 hover:underline"
                    >
                      Review <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Team hours chart */}
        <WeeklyChart data={hoursData} title="Team hours — last 7 days" />
      </div>

      {/* Team member table */}
      <div className="card">
        <div className="border-b border-neutral-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-neutral-700">Team activity</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Name</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Today</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">This week</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Open tasks</th>
                <th className="w-10 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {teamMembers.map(m => (
                <tr key={m.id} className="hover:bg-neutral-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-neutral-800">{m.full_name}</p>
                    <p className="font-mono text-xs text-neutral-400">{m.employee_code}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                    {m.todayMinutes > 0 ? fmtHours(m.todayMinutes) : <span className="text-neutral-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                    {m.weekMinutes > 0 ? fmtHours(m.weekMinutes) : <span className="text-neutral-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={m.openCount > 0 ? 'font-semibold text-neutral-800' : 'text-neutral-300'}>
                      {m.openCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/employees/${m.id}`} className="text-xs text-primary-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {teamMembers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-neutral-400">No team members</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
