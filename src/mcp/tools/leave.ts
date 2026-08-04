import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMcpClient } from '../auth'
import { DateSchema, LeaveDecisionSchema, PaginationSchema, runTool, UuidSchema } from '../helpers'
import { supabaseAdmin } from '@/lib/supabase/admin'

export function registerLeaveTools(server: McpServer) {
  server.registerTool(
    'leave_request',
    {
      title: 'Request Leave',
      description: 'Submit a leave request for the connected employee.',
      inputSchema: {
        start_date: DateSchema,
        end_date: DateSchema,
        half_day: z.boolean().default(false),
        half_day_period: z.enum(['morning', 'afternoon']).optional().nullable(),
        reason: z.string().min(1),
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        if (args.end_date < args.start_date) {
          throw new Error('End date must be on or after the start date')
        }
        if (args.half_day && (args.start_date !== args.end_date || !args.half_day_period)) {
          throw new Error('A half-day request must be a single day with morning/afternoon selected')
        }

        const { data, error } = await supabase
          .from('leave_requests')
          .insert({
            employee_id: profile.id,
            start_date: args.start_date,
            end_date: args.end_date,
            half_day: args.half_day,
            half_day_period: args.half_day ? args.half_day_period : null,
            reason: args.reason,
          })
          .select()
          .single()

        if (error) throw new Error(error.message)
        return data
      }),
  )

  server.registerTool(
    'leave_list',
    {
      title: 'List Leave Requests',
      description: 'List leave requests visible to the connected user (own or team, via RLS).',
      inputSchema: {
        status: z.enum(['pending', 'approved', 'rejected']).optional(),
        ...PaginationSchema,
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase } = getMcpClient(extra)
        let query = supabase
          .from('leave_requests')
          .select(
            '*, employee:profiles!leave_requests_employee_id_fkey(id, full_name, employee_code)',
          )
          .order('created_at', { ascending: false })
          .range(args.offset, args.offset + args.limit - 1)
        if (args.status) query = query.eq('status', args.status)
        const { data, error } = await query
        if (error) throw new Error(error.message)
        return { leave_requests: data ?? [] }
      }),
  )

  server.registerTool(
    'leave_review',
    {
      title: 'Review Leave Request',
      description: 'Approve or reject a leave request (manager/admin, RLS-scoped).',
      inputSchema: {
        id: UuidSchema,
        decision: LeaveDecisionSchema,
        review_note: z.string().optional(),
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        if (!['admin', 'manager'].includes(profile.role)) {
          throw new Error('Access denied.')
        }

        const { data: request } = await supabase
          .from('leave_requests')
          .select('id, employee_id, status')
          .eq('id', args.id)
          .single()

        if (!request) throw new Error('Leave request not found or not visible to you.')
        if (request.status !== 'pending') {
          throw new Error('This request has already been reviewed.')
        }

        const { data, error } = await supabaseAdmin
          .from('leave_requests')
          .update({
            status: args.decision,
            reviewed_by: profile.id,
            reviewed_at: new Date().toISOString(),
            review_note: args.review_note?.trim() || null,
          })
          .eq('id', args.id)
          .select()
          .single()

        if (error) throw new Error(error.message)

        await supabaseAdmin.from('activity_logs').insert({
          tactic_id: null,
          employee_id: request.employee_id,
          action: `leave_request.${args.decision}`,
          meta: {
            reviewed_by: profile.id,
            reviewed_by_name: profile.full_name,
            leave_request_id: args.id,
          },
        })

        return data
      }),
  )
}
