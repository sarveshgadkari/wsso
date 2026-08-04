import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMcpClient } from '../auth'
import { PaginationSchema, runTool, UuidSchema } from '../helpers'

export function registerOrgTools(server: McpServer) {
  server.registerTool(
    'companies_list',
    {
      title: 'List Companies',
      description: 'List companies visible to the connected user.',
      inputSchema: { ...PaginationSchema },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase } = getMcpClient(extra)
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .order('name')
          .range(args.offset, args.offset + args.limit - 1)
        if (error) throw new Error(error.message)
        return { companies: data ?? [] }
      }),
  )

  server.registerTool(
    'companies_get',
    {
      title: 'Get Company',
      description: 'Get a company by ID.',
      inputSchema: { id: UuidSchema },
    },
    async ({ id }, extra) =>
      runTool(async () => {
        const { supabase } = getMcpClient(extra)
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .eq('id', id)
          .single()
        if (error) throw new Error(error.message)
        return data
      }),
  )

  server.registerTool(
    'teams_list',
    {
      title: 'List Teams',
      description: 'List teams, optionally filtered by company.',
      inputSchema: {
        company_id: UuidSchema.optional(),
        ...PaginationSchema,
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase } = getMcpClient(extra)
        let query = supabase
          .from('teams')
          .select('*, manager:profiles!teams_manager_id_fkey(id, full_name, employee_code)')
          .order('name')
          .range(args.offset, args.offset + args.limit - 1)
        if (args.company_id) query = query.eq('company_id', args.company_id)
        const { data, error } = await query
        if (error) throw new Error(error.message)
        return { teams: data ?? [] }
      }),
  )

  server.registerTool(
    'teams_get',
    {
      title: 'Get Team',
      description: 'Get a team by ID with manager info.',
      inputSchema: { id: UuidSchema },
    },
    async ({ id }, extra) =>
      runTool(async () => {
        const { supabase } = getMcpClient(extra)
        const { data, error } = await supabase
          .from('teams')
          .select('*, manager:profiles!teams_manager_id_fkey(id, full_name, employee_code)')
          .eq('id', id)
          .single()
        if (error) throw new Error(error.message)
        return data
      }),
  )

  server.registerTool(
    'org_hierarchy',
    {
      title: 'Get Org Hierarchy',
      description: 'Return companies and teams visible to the connected user.',
      inputSchema: {},
    },
    async (_args, extra) =>
      runTool(async () => {
        const { supabase } = getMcpClient(extra)
        const [companies, teams] = await Promise.all([
          supabase.from('companies').select('id, name, code').order('name'),
          supabase
            .from('teams')
            .select('id, name, company_id, manager_id')
            .order('name'),
        ])
        if (companies.error) throw new Error(companies.error.message)
        if (teams.error) throw new Error(teams.error.message)
        return {
          companies: companies.data ?? [],
          teams: teams.data ?? [],
        }
      }),
  )
}
