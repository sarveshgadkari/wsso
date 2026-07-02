import type { TacticStatus, TacticPriority } from '@/lib/types'

export interface DailyTimeRow {
  id:            string
  full_name:     string
  employee_code: string
  timezone:      string
  minutes:       number
}

export interface WeeklyTimeRow {
  id:            string
  full_name:     string
  employee_code: string
  timezone:      string
  days:          Record<string, number>  // YYYY-MM-DD → minutes
  total:         number
}

export interface PerformanceRow {
  id:                  string
  full_name:           string
  employee_code:       string
  timezone:            string
  assigned:            number
  completed:           number
  overdue:             number
  avg_completion_days: number | null
  clock_hours:         number
}

export interface ProjectProgressRow {
  id:              string
  code:            string
  name:            string
  status:          string
  total_tactics:   number
  done_tactics:    number
  pct_complete:    number
  estimated_hours: number
  logged_hours:    number
}

export interface WorkOrderRow {
  id:              string
  code:            string
  title:           string
  status:          TacticStatus
  priority:        TacticPriority
  due_date:        string | null
  assignee_name:   string
  project_name:    string | null
  estimated_hours: number | null
  created_at:      string
}

export type ReportKey = 'daily' | 'weekly' | 'performance' | 'project' | 'workorders'

export const REPORT_LABELS: Record<ReportKey, string> = {
  daily:       'Daily Time',
  weekly:      'Weekly Time',
  performance: 'Employee Performance',
  project:     'Project Progress',
  workorders:  'Work Orders',
}
