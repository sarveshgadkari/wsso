import Link from 'next/link'
import {
  Building2, Users, FolderOpen, AlertCircle,
  ListTodo, Loader, ChevronRight, FileText,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { closeStaleSessionsForEmployees } from '@/lib/actions/time'
import { WeeklyChart, type DayBar } from '@/components/time/WeeklyChart'
import { StatCard } from './StatCard'
import { TacticCompletionChart, type CompletionBar } from './TacticCompletionChart'
import { isoDate, last7Days, last30Days, daysAgo, dayLabel, monthDayLabel } from '@/lib/utils/dates'
interface OverdueTacticRow {
  id:          string
  assigned_to: string
  assignee:    { id: string; full_name: string; employee_code: string }
}

export async function AdminDashboard() {
  const supabase  = await createClient()
  const today     = isoDate()
  const thirtyAgo = daysAgo(30)
  const sevenAgo  = daysAgo(7)

  const [
    companiesRes,
    employeesRes,
    projectsRes,
    openRes,
    inProgressRes,
    overdueTacticsRes,
    completionLogsRes,
    hoursLogsRes,
    activeEmployeeIdsRes,
    tacticDocsRes,
  ] = await Promise.all([
    supabase.from('companies').select('*', { count: 'exact', head: true }),
    supabase.from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase.from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase.from('tactics')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'assigned'),
    supabase.from('tactics')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'in_progress'),
    // Overdue = due_date in the past, not done or archived
    supabase.from('tactics')
      .select(`
        id, assigned_to,
        assignee:profiles!tactics_assigned_to_fkey(id, full_name, employee_code)
      `)
      .lt('due_date', today)
      .neq('status', 'done')
      .neq('status', 'archived'),
    // Tactics completed in the last 30 days (activity log entries)
    supabase.from('activity_logs')
      .select('id, created_at')
      .eq('action', 'Status changed to Done')
      .gte('created_at', thirtyAgo.toISOString()),
    // Company-wide hours last 7 days
    supabase.from('time_logs')
      .select('log_date, duration_minutes')
      .gte('log_date', isoDate(sevenAgo))
      .not('duration_minutes', 'is', null),
    // Active employee IDs — used for Mechanism 2 stale session check
    supabase.from('profiles').select('id').eq('status', 'active'),
    // TACTIC docs submitted by Managers that need Admin review
    supabase
      .from('tactic_documents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'submitted'),
  ])

  // Mechanism 2: close any stale open sessions (>16 h) for all active employees
  const activeEmployeeIds = (activeEmployeeIdsRes.data ?? []).map((e: { id: string }) => e.id)
  await closeStaleSessionsForEmployees(activeEmployeeIds)

  const overdueTactics = (overdueTacticsRes.data ?? []) as unknown as OverdueTacticRow[]
  const overdueCount   = overdueTactics.length

  // Group overdue by assignee and take top 7
  const overduMap: Record<string, { id: string; full_name: string; employee_code: string; count: number }> = {}
  overdueTactics.forEach(t => {
    const a = t.assignee
    if (!a) return
    if (!overduMap[a.id]) overduMap[a.id] = { ...a, count: 0 }
    overduMap[a.id].count++
  })
  const overdueTop = Object.values(overduMap).sort((a, b) => b.count - a.count).slice(0, 7)

  // Completion chart: count completions per day over last 30 days
  const completionByDate: Record<string, number> = {}
  ;(completionLogsRes.data ?? []).forEach((log: { id: string; created_at: string }) => {
    const date = log.created_at.split('T')[0]
    completionByDate[date] = (completionByDate[date] ?? 0) + 1
  })
  const completionData: CompletionBar[] = last30Days().map(date => ({
    label: monthDayLabel(date),
    date,
    count: completionByDate[date] ?? 0,
  }))

  // Hours chart: company-wide hours per day last 7 days
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

  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-7">
        <StatCard label="Companies"       value={companiesRes.count   ?? 0} icon={Building2} />
        <StatCard label="Employees"       value={employeesRes.count   ?? 0} icon={Users} />
        <StatCard label="Active projects" value={projectsRes.count    ?? 0} icon={FolderOpen} />
        <StatCard label="Open"            value={openRes.count        ?? 0} sub="assigned" icon={ListTodo} />
        <StatCard label="In Progress"     value={inProgressRes.count  ?? 0} sub="active"   icon={Loader} />
        <StatCard
          label="Overdue"
          value={overdueCount}
          sub="need attention"
          variant={overdueCount > 0 ? 'danger' : 'default'}
          icon={AlertCircle}
        />
        <StatCard
          label="TACTICs pending"
          value={tacticDocsRes.count ?? 0}
          sub="awaiting review"
          variant={(tacticDocsRes.count ?? 0) > 0 ? 'warning' : 'default'}
          icon={FileText}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TacticCompletionChart data={completionData} />
        <WeeklyChart data={hoursData} title="Company hours — last 7 days" />
      </div>

      {/* Overdue attention list */}
      {overdueTop.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 border-b border-neutral-200 px-5 py-3">
            <AlertCircle className="h-4 w-4 text-danger-500" />
            <h3 className="text-sm font-semibold text-neutral-700">Employees with overdue tasks</h3>
            <span className="ml-auto text-xs text-neutral-400">Top {overdueTop.length}</span>
          </div>
          <ul className="divide-y divide-neutral-100">
            {overdueTop.map(e => (
              <li key={e.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-neutral-800">{e.full_name}</p>
                  <p className="font-mono text-xs text-neutral-400">{e.employee_code}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-danger-600">
                    {e.count} overdue
                  </span>
                  <Link
                    href={`/employees/${e.id}`}
                    className="flex items-center gap-0.5 text-xs text-primary-600 hover:underline"
                  >
                    Profile <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
