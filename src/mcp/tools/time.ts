import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMcpClient } from '../auth'
import { DateSchema, PaginationSchema, runTool, UuidSchema } from '../helpers'
import { resolveTimezone } from '@/lib/utils/timezones'
import { autoClockOutAt, todayInTimezone } from '@/lib/utils/dates'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { closeOpenSessionsPastMidnight } from '@/lib/time/auto-close'

async function closeStaleOpenSession(
  employeeId: string,
): Promise<void> {
  await closeOpenSessionsPastMidnight(employeeId)
}

export function registerTimeTools(server: McpServer) {
  server.registerTool(
    'time_clock_in',
    {
      title: 'Clock In',
      description: "Start today's clock-in session for the connected employee (one per day).",
      inputSchema: {
        note: z.string().optional(),
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        const tz = resolveTimezone(profile.timezone)
        const today = todayInTimezone(tz)

        const { data: todayLog } = await supabase
          .from('time_logs')
          .select('*')
          .eq('employee_id', profile.id)
          .eq('log_date', today)
          .maybeSingle()

        if (todayLog) {
          if (!todayLog.clock_out_at) {
            throw new Error('Already clocked in today — clock out when you finish.')
          }
          throw new Error('You already have a time entry for today (one session per day in your timezone).')
        }

        await closeStaleOpenSession(profile.id)

        const trimmedNote = args.note?.trim() || null
        const { data, error } = await supabase
          .from('time_logs')
          .insert({
            employee_id: profile.id,
            clock_in_source: 'manual',
            clock_in_note: trimmedNote,
            clock_in_note_status: trimmedNote ? 'pending' : null,
          })
          .select()
          .single()

        if (error) {
          if (error.code === '23505') {
            throw new Error('You already have a time entry for today (one session per day in your timezone).')
          }
          throw new Error(error.message)
        }
        return data
      }),
  )

  server.registerTool(
    'time_clock_out',
    {
      title: 'Clock Out',
      description: 'End the open clock-in session for the connected employee.',
      inputSchema: {
        note: z.string().optional(),
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        const { data: session } = await supabase
          .from('time_logs')
          .select('id, clock_in_at, log_date')
          .eq('employee_id', profile.id)
          .is('clock_out_at', null)
          .maybeSingle()

        if (!session) throw new Error('No open clock-in session found.')

        await closeOpenSessionsPastMidnight(profile.id)

        const { data: stillOpen } = await supabase
          .from('time_logs')
          .select('id, clock_in_at, log_date')
          .eq('id', session.id)
          .is('clock_out_at', null)
          .maybeSingle()

        if (!stillOpen) throw new Error('Session was auto-closed at local midnight.')

        const tz = resolveTimezone(profile.timezone)
        const cap = autoClockOutAt(new Date(stillOpen.clock_in_at), stillOpen.log_date, tz)
        let clockOutAt = Date.now()
        const clockInAt = new Date(stillOpen.clock_in_at).getTime()
        if (clockOutAt <= clockInAt) clockOutAt = clockInAt + 1000
        if (clockOutAt > cap.getTime()) clockOutAt = cap.getTime()

        const trimmedNote = args.note?.trim() || null
        const { data, error } = await supabase
          .from('time_logs')
          .update({
            clock_out_at: new Date(clockOutAt).toISOString(),
            closed_reason: 'manual',
            clock_out_note: trimmedNote,
            clock_out_note_status: trimmedNote ? 'pending' : null,
          })
          .eq('id', stillOpen.id)
          .select()
          .single()

        if (error) throw new Error(error.message)
        return data
      }),
  )

  server.registerTool(
    'time_active_session',
    {
      title: 'Get Active Session',
      description: 'Check whether the connected employee is currently clocked in.',
      inputSchema: {},
    },
    async (_args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        const { data } = await supabase
          .from('time_logs')
          .select('*')
          .eq('employee_id', profile.id)
          .is('clock_out_at', null)
          .maybeSingle()
        return { active: !!data, session: data }
      }),
  )

  server.registerTool(
    'time_my_logs',
    {
      title: 'My Time Logs',
      description: 'List the connected employee\'s time logs, optionally filtered by date range.',
      inputSchema: {
        start_date: DateSchema.optional(),
        end_date: DateSchema.optional(),
        ...PaginationSchema,
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        let query = supabase
          .from('time_logs')
          .select('*')
          .eq('employee_id', profile.id)
          .order('log_date', { ascending: false })
          .range(args.offset, args.offset + args.limit - 1)

        if (args.start_date) query = query.gte('log_date', args.start_date)
        if (args.end_date) query = query.lte('log_date', args.end_date)

        const { data, error } = await query
        if (error) throw new Error(error.message)
        return { logs: data ?? [] }
      }),
  )

  server.registerTool(
    'time_team_logs',
    {
      title: 'Team Time Logs',
      description: 'List team time logs visible to managers/admins (RLS-scoped).',
      inputSchema: {
        employee_id: UuidSchema.optional(),
        start_date: DateSchema.optional(),
        end_date: DateSchema.optional(),
        ...PaginationSchema,
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        if (!['admin', 'manager', 'director'].includes(profile.role)) {
          throw new Error('Unauthorized: team time logs require manager/admin/director')
        }

        let query = supabase
          .from('time_logs')
          .select(
            '*, employee:profiles!time_logs_employee_id_fkey(id, full_name, employee_code)',
          )
          .order('log_date', { ascending: false })
          .range(args.offset, args.offset + args.limit - 1)

        if (args.employee_id) query = query.eq('employee_id', args.employee_id)
        if (args.start_date) query = query.gte('log_date', args.start_date)
        if (args.end_date) query = query.lte('log_date', args.end_date)

        const { data, error } = await query
        if (error) throw new Error(error.message)
        return { logs: data ?? [] }
      }),
  )

  server.registerTool(
    'time_force_clock_out',
    {
      title: 'Force Clock Out',
      description: 'Force-close another employee\'s open session (manager/admin).',
      inputSchema: {
        time_log_id: UuidSchema,
        employee_id: UuidSchema,
        clock_out_at: z.string().min(1).optional(),
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        if (!['admin', 'manager'].includes(profile.role)) {
          throw new Error('Access denied.')
        }

        const clockOut = args.clock_out_at ? new Date(args.clock_out_at) : new Date()
        if (isNaN(clockOut.getTime())) throw new Error('Invalid datetime.')

        const { data: session } = await supabase
          .from('time_logs')
          .select('id, clock_in_at')
          .eq('id', args.time_log_id)
          .eq('employee_id', args.employee_id)
          .is('clock_out_at', null)
          .single()

        if (!session) throw new Error('Session not found or already closed.')
        if (clockOut <= new Date(session.clock_in_at)) {
          throw new Error('Clock-out must be after clock-in.')
        }
        if (clockOut.getTime() - new Date(session.clock_in_at).getTime() > 24 * 60 * 60 * 1000) {
          throw new Error('A shift cannot be longer than 24 hours.')
        }

        const { data, error } = await supabaseAdmin
          .from('time_logs')
          .update({
            clock_out_at: clockOut.toISOString(),
            closed_reason: 'admin_correction',
            auto_closed: true,
          })
          .eq('id', args.time_log_id)
          .select()
          .single()

        if (error) throw new Error(error.message)

        await supabaseAdmin.from('activity_logs').insert({
          tactic_id: null,
          employee_id: args.employee_id,
          action: 'time_log.force_closed',
          meta: {
            closed_by: profile.id,
            closed_by_name: profile.full_name,
            time_log_id: args.time_log_id,
            clock_out_at: clockOut.toISOString(),
          },
        })

        return data
      }),
  )
}
