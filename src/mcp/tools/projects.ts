import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMcpClient } from '../auth'
import { PaginationSchema, runTool, UuidSchema } from '../helpers'

export function registerProjectTools(server: McpServer) {
  server.registerTool(
    'projects_list',
    {
      title: 'List Projects',
      description: 'List projects visible to the connected user.',
      inputSchema: {
        status: z.enum(['active', 'on_hold', 'completed']).optional(),
        company_id: UuidSchema.optional(),
        ...PaginationSchema,
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase } = getMcpClient(extra)
        let query = supabase
          .from('projects')
          .select('id, code, name, status, company_id, client_id, manager_id, created_at')
          .order('name')
          .range(args.offset, args.offset + args.limit - 1)
        if (args.status) query = query.eq('status', args.status)
        if (args.company_id) query = query.eq('company_id', args.company_id)
        const { data, error } = await query
        if (error) throw new Error(error.message)
        return { projects: data ?? [] }
      }),
  )

  server.registerTool(
    'projects_get',
    {
      title: 'Get Project',
      description: 'Get a project by ID.',
      inputSchema: { id: UuidSchema },
    },
    async ({ id }, extra) =>
      runTool(async () => {
        const { supabase } = getMcpClient(extra)
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .single()
        if (error) throw new Error(error.message)
        return data
      }),
  )

  server.registerTool(
    'projects_create',
    {
      title: 'Create Project',
      description: 'Create a project (admin/manager). Managers are set as project manager.',
      inputSchema: {
        name: z.string().min(1),
        company_id: UuidSchema,
        client_id: UuidSchema.optional().nullable(),
        manager_id: UuidSchema.optional().nullable(),
        status: z.enum(['active', 'on_hold', 'completed']).optional().default('active'),
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        if (!['admin', 'manager'].includes(profile.role)) {
          throw new Error('Unauthorized')
        }

        const { data, error } = await supabase
          .from('projects')
          .insert({
            name: args.name,
            company_id: args.company_id,
            client_id: args.client_id ?? null,
            manager_id: profile.role === 'manager' ? profile.id : (args.manager_id ?? null),
            status: args.status ?? 'active',
          })
          .select()
          .single()

        if (error) throw new Error(error.message)
        return data
      }),
  )

  server.registerTool(
    'clients_list',
    {
      title: 'List Clients',
      description: 'List clients visible to the connected user.',
      inputSchema: {
        company_id: UuidSchema.optional(),
        ...PaginationSchema,
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase } = getMcpClient(extra)
        let query = supabase
          .from('clients')
          .select('*')
          .order('name')
          .range(args.offset, args.offset + args.limit - 1)
        if (args.company_id) query = query.eq('company_id', args.company_id)
        const { data, error } = await query
        if (error) throw new Error(error.message)
        return { clients: data ?? [] }
      }),
  )

  server.registerTool(
    'clients_get',
    {
      title: 'Get Client',
      description: 'Get a client by ID.',
      inputSchema: { id: UuidSchema },
    },
    async ({ id }, extra) =>
      runTool(async () => {
        const { supabase } = getMcpClient(extra)
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('id', id)
          .single()
        if (error) throw new Error(error.message)
        return data
      }),
  )
}
