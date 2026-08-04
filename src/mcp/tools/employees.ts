import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMcpClient } from '../auth'
import { PaginationSchema, runTool, UuidSchema } from '../helpers'

export function registerEmployeeTools(server: McpServer) {
  server.registerTool(
    'employees_list',
    {
      title: 'List Employees',
      description:
        'List employees visible to the connected user (RLS-scoped). Optional filters by role and status.',
      inputSchema: {
        role: z.enum(['admin', 'director', 'manager', 'employee']).optional(),
        status: z.enum(['active', 'inactive']).optional(),
        search: z.string().optional(),
        ...PaginationSchema,
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase } = getMcpClient(extra)
        let query = supabase
          .from('profiles')
          .select('id, full_name, employee_code, role, status, department, phone, timezone')
          .order('full_name')
          .range(args.offset, args.offset + args.limit - 1)

        if (args.role) query = query.eq('role', args.role)
        if (args.status) query = query.eq('status', args.status)
        if (args.search?.trim()) {
          const term = args.search
            .trim()
            .replace(/[%_,.()]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
          if (term) {
            query = query.or(
              `full_name.ilike.%${term}%,employee_code.ilike.%${term}%`,
            )
          }
        }

        const { data, error } = await query
        if (error) throw new Error(error.message)
        return { count: data?.length ?? 0, employees: data ?? [] }
      }),
  )

  server.registerTool(
    'employees_get',
    {
      title: 'Get Employee',
      description: 'Get a single employee profile by ID (RLS-scoped).',
      inputSchema: {
        id: UuidSchema,
      },
    },
    async ({ id }, extra) =>
      runTool(async () => {
        const { supabase } = getMcpClient(extra)
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .single()
        if (error) throw new Error(error.message)
        return data
      }),
  )

  server.registerTool(
    'employees_me',
    {
      title: 'Get My Profile',
      description: 'Return the profile of the currently connected employee.',
      inputSchema: {},
    },
    async (_args, extra) =>
      runTool(async () => {
        const { profile } = getMcpClient(extra)
        return profile
      }),
  )
}
