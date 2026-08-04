import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMcpClient } from '../auth'
import { LeadStatusSchema, PaginationSchema, runTool, UuidSchema } from '../helpers'
import { supabaseAdmin } from '@/lib/supabase/admin'

export function registerLeadTools(server: McpServer) {
  server.registerTool(
    'leads_list',
    {
      title: 'List Leads',
      description: 'List CRM leads visible to the connected user.',
      inputSchema: {
        status: LeadStatusSchema.optional(),
        ...PaginationSchema,
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase } = getMcpClient(extra)
        let query = supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false })
          .range(args.offset, args.offset + args.limit - 1)
        if (args.status) query = query.eq('status', args.status)
        const { data, error } = await query
        if (error) throw new Error(error.message)
        return { leads: data ?? [] }
      }),
  )

  server.registerTool(
    'leads_update_status',
    {
      title: 'Update Lead Status',
      description: 'Update a lead status (admin or assigned employee).',
      inputSchema: {
        id: UuidSchema,
        status: LeadStatusSchema,
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)

        if (profile.role !== 'admin') {
          const { data: assignment } = await supabase
            .from('lead_assignments')
            .select('id')
            .eq('lead_id', args.id)
            .eq('employee_id', profile.id)
            .maybeSingle()
          if (!assignment) throw new Error('You are not assigned to this lead')
        }

        const { data, error } = await supabase
          .from('leads')
          .update({ status: args.status })
          .eq('id', args.id)
          .select()
          .single()

        if (error) throw new Error(error.message)
        return data
      }),
  )

  server.registerTool(
    'leads_assign',
    {
      title: 'Assign Lead',
      description: 'Assign a lead to an employee (admin only).',
      inputSchema: {
        lead_id: UuidSchema,
        employee_id: UuidSchema,
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { profile } = getMcpClient(extra)
        if (profile.role !== 'admin') throw new Error('Admin only')

        const { data: target } = await supabaseAdmin
          .from('profiles')
          .select('id, status')
          .eq('id', args.employee_id)
          .single()

        if (!target || target.status !== 'active') throw new Error('User not found')

        const { error } = await supabaseAdmin.from('lead_assignments').insert({
          lead_id: args.lead_id,
          employee_id: args.employee_id,
          assigned_by: profile.id,
        })

        if (error) {
          if (error.code === '23505') throw new Error('Already assigned to this person')
          throw new Error(error.message)
        }

        return { ok: true }
      }),
  )
}
