'use client'

import { useState } from 'react'
import {
  Calendar, CalendarDays, Users, FolderKanban, ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DailyTimeReport }           from './DailyTimeReport'
import { WeeklyTimeReport }          from './WeeklyTimeReport'
import { EmployeePerformanceReport } from './EmployeePerformanceReport'
import { ProjectProgressReport }     from './ProjectProgressReport'
import { WorkOrdersReport }          from './WorkOrdersReport'
import type { ReportKey } from './report-types'
import { REPORT_LABELS }  from './report-types'

const NAV: { key: ReportKey; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { key: 'daily',       icon: Calendar,       desc: 'Hours per employee for one day' },
  { key: 'weekly',      icon: CalendarDays,   desc: 'Daily breakdown across one week' },
  { key: 'performance', icon: Users,          desc: 'Completion rates, overdue, clock hours' },
  { key: 'project',     icon: FolderKanban,   desc: 'Work order progress & estimated vs actual hours' },
  { key: 'workorders',  icon: ClipboardList,  desc: 'Filtered work order list for print/export' },
]

const REPORT_MAP: Record<ReportKey, React.ReactNode> = {
  daily:       <DailyTimeReport />,
  weekly:      <WeeklyTimeReport />,
  performance: <EmployeePerformanceReport />,
  project:     <ProjectProgressReport />,
  workorders:  <WorkOrdersReport />,
}

interface Props {
  role: string
}

export function ReportsShell({ role }: Props) {
  const [active, setActive] = useState<ReportKey>('daily')

  return (
    <div className="flex gap-5 print:block">
      {/* Left picker — hidden when printing */}
      <aside className="w-56 shrink-0 print:hidden">
        <nav className="flex flex-col gap-1">
          {NAV.map(item => {
            const Icon = item.icon
            const isActive = active === item.key
            return (
              <button
                key={item.key}
                onClick={() => setActive(item.key)}
                className={cn(
                  'flex flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-800'
                    : 'text-neutral-600 hover:bg-neutral-100',
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary-600' : 'text-neutral-400')} />
                  <span className="text-sm font-medium">{REPORT_LABELS[item.key]}</span>
                </div>
                <p className={cn('pl-6 text-xs', isActive ? 'text-primary-500' : 'text-neutral-400')}>
                  {item.desc}
                </p>
              </button>
            )
          })}
        </nav>

        {role === 'manager' && (
          <p className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
            Showing data scoped to your team.
          </p>
        )}
      </aside>

      {/* Report content */}
      <div className="min-w-0 flex-1">
        {/* Print-only header */}
        <div className="hidden print:block print:mb-4">
          <h2 className="text-base font-semibold">{REPORT_LABELS[active]}</h2>
        </div>

        {REPORT_MAP[active]}
      </div>
    </div>
  )
}
