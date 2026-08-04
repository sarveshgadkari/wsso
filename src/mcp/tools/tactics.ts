import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMcpClient } from '../auth'
import {
  DateSchema,
  PaginationSchema,
  runTool,
  TacticPrioritySchema,
  TacticStatusSchema,
  UuidSchema,
} from '../helpers'
import { getAllowedNext, STATUS_LABEL } from '@/lib/tactics-utils'
import type { TacticStatus } from '@/lib/types'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { insertNotification } from '@/lib/actions/notifications'

export function registerTacticTools(server: McpServer) {
  server.registerTool(
    'tactics_list',
    {
      title: 'List Work Orders',
      description:
        'List work orders (tactics) visible to the connected user. Supports status, priority, assignee, and project filters.',
      inputSchema: {
        status: TacticStatusSchema.optional(),
        priority: TacticPrioritySchema.optional(),
        assigned_to: UuidSchema.optional(),
        project_id: UuidSchema.optional(),
        ...PaginationSchema,
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase } = getMcpClient(extra)
        let query = supabase
          .from('tactics')
          .select(
            `id, code, title, status, priority, due_date, estimated_hours, assigned_to, created_by, project_id, created_at,
             assignee:profiles!tactics_assigned_to_fkey(id, full_name, employee_code),
             project:projects(id, name, code)`,
          )
          .order('created_at', { ascending: false })
          .range(args.offset, args.offset + args.limit - 1)

        if (args.status) query = query.eq('status', args.status)
        if (args.priority) query = query.eq('priority', args.priority)
        if (args.assigned_to) query = query.eq('assigned_to', args.assigned_to)
        if (args.project_id) query = query.eq('project_id', args.project_id)

        const { data, error } = await query
        if (error) throw new Error(error.message)
        return { tactics: data ?? [] }
      }),
  )

  server.registerTool(
    'tactics_get',
    {
      title: 'Get Work Order',
      description: 'Get a work order with recent activity logs.',
      inputSchema: { id: UuidSchema },
    },
    async ({ id }, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        const { data: tactic, error } = await supabase
          .from('tactics')
          .select(
            `*,
             assignee:profiles!tactics_assigned_to_fkey(id, full_name, employee_code),
             creator:profiles!tactics_created_by_fkey(id, full_name, employee_code),
             project:projects(id, name, code)`,
          )
          .eq('id', id)
          .single()
        if (error) throw new Error(error.message)

        const { data: logs } = await supabase
          .from('activity_logs')
          .select('id, action, notes, hours_logged, created_at, employee_id')
          .eq('tactic_id', id)
          .order('created_at', { ascending: false })
          .limit(20)

        const allowedNext = getAllowedNext(tactic.status as TacticStatus, profile.role, {
          isCreator: tactic.created_by === profile.id,
          isAssignee: tactic.assigned_to === profile.id,
        })

        return { tactic, activity_logs: logs ?? [], allowed_next_statuses: allowedNext }
      }),
  )

  server.registerTool(
    'tactics_create',
    {
      title: 'Create Work Order',
      description: 'Create a work order (admin/manager only). Starts as assigned.',
      inputSchema: {
        title: z.string().min(1).max(200),
        description: z.string().optional().nullable(),
        training_notes: z.string().optional().nullable(),
        training_link: z.string().url().optional().nullable().or(z.literal('')),
        project_id: UuidSchema.optional().nullable(),
        assigned_to: UuidSchema,
        priority: TacticPrioritySchema,
        due_date: DateSchema.optional().nullable(),
        estimated_hours: z.number().positive().max(9999).optional().nullable(),
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        if (!['admin', 'manager'].includes(profile.role)) {
          throw new Error('Unauthorized: only admin/manager can create work orders')
        }

        const { data, error } = await supabase
          .from('tactics')
          .insert({
            title: args.title,
            description: args.description ?? null,
            training_notes: args.training_notes ?? null,
            training_link: args.training_link || null,
            project_id: args.project_id ?? null,
            assigned_to: args.assigned_to,
            created_by: profile.id,
            priority: args.priority,
            due_date: args.due_date ?? null,
            estimated_hours: args.estimated_hours ?? null,
            status: 'assigned',
          })
          .select()
          .single()
        if (error) throw new Error(error.message)

        await supabaseAdmin.from('activity_logs').insert({
          tactic_id: data.id,
          employee_id: profile.id,
          action: 'Tactic created',
        })

        if (args.assigned_to !== profile.id) {
          await insertNotification(
            args.assigned_to,
            'tactic_assigned',
            `You've been assigned a new task: "${args.title}"`,
            `/tactics/${data.id}`,
          )
        }

        return data
      }),
  )

  server.registerTool(
    'tactics_update',
    {
      title: 'Update Work Order',
      description: 'Update work order fields (admin/manager only).',
      inputSchema: {
        id: UuidSchema,
        title: z.string().min(1).max(200),
        description: z.string().optional().nullable(),
        training_notes: z.string().optional().nullable(),
        training_link: z.string().url().optional().nullable().or(z.literal('')),
        project_id: UuidSchema.optional().nullable(),
        assigned_to: UuidSchema,
        priority: TacticPrioritySchema,
        due_date: DateSchema.optional().nullable(),
        estimated_hours: z.number().positive().max(9999).optional().nullable(),
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        if (!['admin', 'manager'].includes(profile.role)) {
          throw new Error('Unauthorized: only admin/manager can update work orders')
        }

        const { data, error } = await supabase
          .from('tactics')
          .update({
            title: args.title,
            description: args.description ?? null,
            training_notes: args.training_notes ?? null,
            training_link: args.training_link || null,
            project_id: args.project_id ?? null,
            assigned_to: args.assigned_to,
            priority: args.priority,
            due_date: args.due_date ?? null,
            estimated_hours: args.estimated_hours ?? null,
          })
          .eq('id', args.id)
          .select()
          .single()
        if (error) throw new Error(error.message)

        await supabaseAdmin.from('activity_logs').insert({
          tactic_id: args.id,
          employee_id: profile.id,
          action: 'Tactic updated',
        })

        return data
      }),
  )

  server.registerTool(
    'tactics_transition_status',
    {
      title: 'Transition Work Order Status',
      description:
        'Move a work order to the next allowed status. Enforces creator/assignee rules: managers cannot approve their own work or another manager\'s work; only assignees progress assigned→review.',
      inputSchema: {
        id: UuidSchema,
        target_status: TacticStatusSchema,
        comment: z.string().optional(),
        work_notes: z.string().optional(),
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)

        const { data: tactic, error: fetchErr } = await supabase
          .from('tactics')
          .select('id, title, status, assigned_to, created_by')
          .eq('id', args.id)
          .single()
        if (fetchErr || !tactic) throw new Error('Tactic not found or access denied')

        const currentStatus = tactic.status as TacticStatus
        const ctx = {
          isCreator: tactic.created_by === profile.id,
          isAssignee: tactic.assigned_to === profile.id,
        }
        const allowed = getAllowedNext(currentStatus, profile.role, ctx)
        if (!allowed.includes(args.target_status)) {
          throw new Error(
            `Cannot transition from "${STATUS_LABEL[currentStatus]}" to "${STATUS_LABEL[args.target_status]}"`,
          )
        }

        if (
          currentStatus === 'review' &&
          args.target_status === 'in_progress' &&
          !args.comment?.trim()
        ) {
          throw new Error('A reason is required when sending a tactic back to In Progress')
        }

        const trimmedWorkNotes = args.work_notes?.trim()
        if (args.target_status === 'review' && trimmedWorkNotes) {
          await supabaseAdmin.from('activity_logs').insert({
            tactic_id: args.id,
            employee_id: profile.id,
            action: 'Work update',
            notes: trimmedWorkNotes,
          })
        }

        const { error: updateErr } = await supabase
          .from('tactics')
          .update({ status: args.target_status })
          .eq('id', args.id)
        if (updateErr) throw new Error(updateErr.message)

        await supabaseAdmin.from('activity_logs').insert({
          tactic_id: args.id,
          employee_id: profile.id,
          action: `Status changed to ${STATUS_LABEL[args.target_status]}`,
          notes: args.comment?.trim() || null,
        })

        if (tactic.assigned_to !== profile.id) {
          await insertNotification(
            tactic.assigned_to,
            'tactic_status',
            `"${tactic.title}" moved to ${STATUS_LABEL[args.target_status]}`,
            `/tactics/${args.id}`,
          )
        }

        if (args.target_status === 'review' && tactic.created_by !== profile.id) {
          await insertNotification(
            tactic.created_by,
            'tactic_review',
            `"${tactic.title}" is ready for your review`,
            `/tactics/${args.id}`,
          )
        }

        return { id: args.id, status: args.target_status }
      }),
  )

  server.registerTool(
    'tactics_log_hours',
    {
      title: 'Log Hours on Work Order',
      description: 'Log hours against a work order.',
      inputSchema: {
        id: UuidSchema,
        hours: z.number().positive().max(24),
        notes: z.string().optional(),
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        const { data: tactic } = await supabase
          .from('tactics')
          .select('id')
          .eq('id', args.id)
          .single()
        if (!tactic) throw new Error('Tactic not found or access denied')

        await supabaseAdmin.from('activity_logs').insert({
          tactic_id: args.id,
          employee_id: profile.id,
          action: `Logged ${args.hours}h`,
          hours_logged: args.hours,
          notes: args.notes?.trim() || null,
        })

        return { ok: true }
      }),
  )

  server.registerTool(
    'tactics_submit_work_update',
    {
      title: 'Submit Work Update',
      description: 'Add a work progress note without changing status.',
      inputSchema: {
        id: UuidSchema,
        notes: z.string().min(1),
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        const { data: tactic } = await supabase
          .from('tactics')
          .select('id, assigned_to, status')
          .eq('id', args.id)
          .single()
        if (!tactic) throw new Error('Work order not found or access denied')
        if (profile.role === 'employee' && tactic.assigned_to !== profile.id) {
          throw new Error('You can only update work orders assigned to you')
        }
        if (['done', 'archived'].includes(tactic.status)) {
          throw new Error('This work order is already completed')
        }

        await supabaseAdmin.from('activity_logs').insert({
          tactic_id: args.id,
          employee_id: profile.id,
          action: 'Work update',
          notes: args.notes.trim(),
        })

        return { ok: true }
      }),
  )

  server.registerTool(
    'tactics_delete',
    {
      title: 'Delete Work Order',
      description: 'Delete a work order (creator or admin only).',
      inputSchema: { id: UuidSchema },
    },
    async ({ id }, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        const { data: tactic, error: fetchErr } = await supabase
          .from('tactics')
          .select('id, code, created_by')
          .eq('id', id)
          .single()
        if (fetchErr || !tactic) throw new Error('Work order not found or access denied')
        if (profile.role !== 'admin' && tactic.created_by !== profile.id) {
          throw new Error('Only the creator or an admin can delete this work order')
        }

        const { error } = await supabase.from('tactics').delete().eq('id', id)
        if (error) throw new Error(error.message)
        return { deleted: id }
      }),
  )
}
