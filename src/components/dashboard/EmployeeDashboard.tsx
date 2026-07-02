import Link from 'next/link'
import type { ComponentType } from 'react'
import { AlertCircle, Clock, CheckCircle2, CalendarDays, Timer } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth/session'
import { ClockWidget } from '@/components/time/ClockWidget'
import { StatCard } from './StatCard'
import { Badge } from '@/components/ui/Badge'
import {
  STATUS_LABEL, STATUS_VARIANT,
  PRIORITY_LABEL, PRIORITY_VARIANT,
} from '@/lib/tactics-utils'
import {
  todayInTimezone,
  startOfWeekInTimezone,
  daysAgo,
  addCalendarDays,
} from '@/lib/utils/dates'
import { resolveTimezone } from '@/lib/utils/timezones'
import type { TacticStatus, TacticPriority } from '@/lib/types'

interface MyTacticRow {
  id:       string
  code:     string
  title:    string
  due_date: string | null
  status:   TacticStatus
  priority: TacticPriority
}

function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function TacticItem({ tactic, rowCls }: { tactic: MyTacticRow; rowCls?: string }) {
  return (
    <Link
      href={`/tactics/${tactic.id}`}
      className={`flex items-center gap-3 px-5 py-3 hover:bg-neutral-50 ${rowCls ?? ''}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-800">{tactic.title}</p>
        <p className="font-mono text-xs text-neutral-400">{tactic.code}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={PRIORITY_VARIANT[tactic.priority]}>
          {PRIORITY_LABEL[tactic.priority]}
        </Badge>
        <Badge variant={STATUS_VARIANT[tactic.status]}>
          {STATUS_LABEL[tactic.status]}
        </Badge>
        {tactic.due_date && (
          <span className="text-xs text-neutral-400">{tactic.due_date}</span>
        )}
      </div>
    </Link>
  )
}

function TacticSection({
  icon: Icon,
  label,
  items,
  iconCls,
  rowCls,
  emptyText,
}: {
  icon:      ComponentType<{ className?: string }>
  label:     string
  items:     MyTacticRow[]
  iconCls:   string
  rowCls?:   string
  emptyText: string
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-5 py-3">
        <Icon className={`h-4 w-4 ${iconCls}`} />
        <h3 className="text-sm font-semibold text-neutral-700">{label}</h3>
        <span className="ml-auto rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-bold text-neutral-500">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-5 text-center text-sm text-neutral-400">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map(t => (
            <li key={t.id}>
              <TacticItem tactic={t} rowCls={rowCls} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export async function EmployeeDashboard() {
  const profile  = await getProfile()
  const tz       = resolveTimezone(profile?.timezone)
  const supabase = await createClient()
  const today      = todayInTimezone(tz)
  const weekStart  = startOfWeekInTimezone(tz)
  const weekEnd    = addCalendarDays(weekStart, 6)
  const thirtyAgo  = daysAgo(30)

  const [
    myTacticsRes,
    todayLogsRes,
    weekLogsRes,
    completedRes,
  ] = await Promise.all([
    supabase.from('tactics')
      .select('id, code, title, due_date, status, priority')
      .neq('status', 'archived')
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('time_logs')
      .select('duration_minutes')
      .eq('log_date', today)
      .not('duration_minutes', 'is', null),
    supabase.from('time_logs')
      .select('duration_minutes')
      .gte('log_date', weekStart)
      .not('duration_minutes', 'is', null),
    supabase.from('tactics')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'done')
      .gte('updated_at', thirtyAgo.toISOString()),
  ])

  const myTactics = (myTacticsRes.data ?? []) as MyTacticRow[]

  const overdue:   MyTacticRow[] = []
  const dueToday:  MyTacticRow[] = []
  const dueWeek:   MyTacticRow[] = []
  const remaining: MyTacticRow[] = []

  myTactics.forEach(t => {
    if (!t.due_date) { remaining.push(t); return }
    if (t.due_date < today)              { overdue.push(t);   return }
    if (t.due_date === today)            { dueToday.push(t);  return }
    if (t.due_date >= weekStart && t.due_date <= weekEnd) { dueWeek.push(t); return }
    remaining.push(t)
  })

  const sumMinutes = (rows: { duration_minutes: number | null }[]) =>
    rows.reduce((s, r) => s + (r.duration_minutes ?? 0), 0)

  const todayMin = sumMinutes(todayLogsRes.data ?? [])
  const weekMin  = sumMinutes(weekLogsRes.data  ?? [])

  return (
    <div className="flex flex-col gap-6">
      <ClockWidget />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Today"
          value={todayMin > 0 ? fmtHours(todayMin) : '0m'}
          sub="hours logged"
          icon={Timer}
        />
        <StatCard
          label="This week"
          value={weekMin > 0 ? fmtHours(weekMin) : '0m'}
          sub="hours logged"
          icon={CalendarDays}
        />
        <StatCard
          label="Completed"
          value={completedRes.count ?? 0}
          sub="last 30 days"
          variant="success"
          icon={CheckCircle2}
        />
        <StatCard
          label="Overdue"
          value={overdue.length}
          sub="need attention"
          variant={overdue.length > 0 ? 'danger' : 'default'}
          icon={AlertCircle}
        />
      </div>

      <div className="flex gap-3">
        <Link
          href="/time"
          className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
        >
          <Clock className="h-4 w-4 text-primary-500" />
          My Time
        </Link>
        <Link
          href="/tactics"
          className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
        >
          <CalendarDays className="h-4 w-4 text-primary-500" />
          All My Tasks
        </Link>
      </div>

      <TacticSection
        icon={AlertCircle}
        label="Overdue"
        items={overdue}
        iconCls="text-danger-500"
        rowCls="bg-red-50 hover:bg-red-100"
        emptyText="No overdue tasks — great work!"
      />
      <TacticSection
        icon={Clock}
        label="Due today"
        items={dueToday}
        iconCls="text-warning-500"
        rowCls="bg-amber-50 hover:bg-amber-100"
        emptyText="Nothing due today"
      />
      <TacticSection
        icon={CalendarDays}
        label="Due this week"
        items={dueWeek}
        iconCls="text-primary-500"
        emptyText="Nothing else due this week"
      />

      {remaining.length > 0 && (
        <div className="text-right">
          <Link href="/tactics" className="text-sm text-primary-600 hover:underline">
            +{remaining.length} more task{remaining.length !== 1 ? 's' : ''} →
          </Link>
        </div>
      )}
    </div>
  )
}
