import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMcpClient } from '../auth'
import { DateSchema, runTool, UuidSchema } from '../helpers'

export function registerReportTools(server: McpServer) {
  server.registerTool(
    'reports_timesheet',
    {
      title: 'Timesheet Report',
      description: 'Summarize time logs for a date range (own logs for employees; broader for managers via RLS).',
      inputSchema: {
        start_date: DateSchema,
        end_date: DateSchema,
        employee_id: UuidSchema.optional(),
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        let query = supabase
          .from('time_logs')
          .select(
            'id, employee_id, log_date, clock_in_at, clock_out_at, closed_reason, employee:profiles!time_logs_employee_id_fkey(full_name, employee_code)',
          )
          .gte('log_date', args.start_date)
          .lte('log_date', args.end_date)
          .order('log_date', { ascending: true })

        if (args.employee_id) {
          if (profile.role === 'employee' && args.employee_id !== profile.id) {
            throw new Error('Employees can only view their own timesheet')
          }
          query = query.eq('employee_id', args.employee_id)
        } else if (profile.role === 'employee') {
          query = query.eq('employee_id', profile.id)
        }

        const { data, error } = await query
        if (error) throw new Error(error.message)

        const rows = (data ?? []).map((log) => {
          const start = log.clock_in_at ? new Date(log.clock_in_at).getTime() : null
          const end = log.clock_out_at ? new Date(log.clock_out_at).getTime() : null
          const hours =
            start && end && end > start ? Number(((end - start) / 3_600_000).toFixed(2)) : null
          return { ...log, hours }
        })

        const totalHours = rows.reduce((sum, r) => sum + (r.hours ?? 0), 0)
        return { total_hours: Number(totalHours.toFixed(2)), entries: rows }
      }),
  )

  server.registerTool(
    'reports_work_orders',
    {
      title: 'Work Orders Report',
      description: 'Status breakdown of work orders visible to the connected user.',
      inputSchema: {
        project_id: UuidSchema.optional(),
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase } = getMcpClient(extra)
        let query = supabase.from('tactics').select('id, status, priority, project_id')
        if (args.project_id) query = query.eq('project_id', args.project_id)
        const { data, error } = await query
        if (error) throw new Error(error.message)

        const byStatus: Record<string, number> = {}
        const byPriority: Record<string, number> = {}
        for (const t of data ?? []) {
          byStatus[t.status] = (byStatus[t.status] ?? 0) + 1
          byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1
        }

        return {
          total: data?.length ?? 0,
          by_status: byStatus,
          by_priority: byPriority,
        }
      }),
  )

  server.registerTool(
    'reports_project_progress',
    {
      title: 'Project Progress Report',
      description: 'Work-order completion stats for a project.',
      inputSchema: {
        project_id: UuidSchema,
      },
    },
    async ({ project_id }, extra) =>
      runTool(async () => {
        const { supabase } = getMcpClient(extra)
        const { data: project, error: pErr } = await supabase
          .from('projects')
          .select('id, name, code, status')
          .eq('id', project_id)
          .single()
        if (pErr) throw new Error(pErr.message)

        const { data: tactics, error } = await supabase
          .from('tactics')
          .select('id, status')
          .eq('project_id', project_id)
        if (error) throw new Error(error.message)

        const total = tactics?.length ?? 0
        const done = (tactics ?? []).filter((t) => t.status === 'done' || t.status === 'archived').length
        return {
          project,
          total_work_orders: total,
          completed: done,
          completion_pct: total ? Math.round((done / total) * 100) : 0,
        }
      }),
  )
}
