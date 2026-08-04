import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMcpClient } from './auth'
import {
  LEAD_STATUSES,
  PROJECT_STATUSES,
  TACTIC_PRIORITIES,
  TACTIC_STATUSES,
  USER_ROLES,
} from '@/lib/types'

function jsonResource(uri: string, data: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(data, null, 2),
      },
    ],
  }
}

export function registerResources(server: McpServer) {
  server.registerResource(
    'wsso-roles',
    'wsso://roles',
    {
      title: 'WSSO Roles',
      description: 'User roles and high-level permission summary',
      mimeType: 'application/json',
    },
    async (uri) =>
      jsonResource(uri.href, {
        roles: USER_ROLES,
        notes: {
          admin: 'Full access',
          director: 'Read-mostly across data',
          manager:
            "Team-scoped write; cannot approve own or another manager's work orders",
          employee: 'Own data and assigned work only',
        },
      }),
  )

  server.registerResource(
    'wsso-statuses',
    'wsso://statuses',
    {
      title: 'WSSO Status Enums',
      description: 'Status and priority enums used across WSSO',
      mimeType: 'application/json',
    },
    async (uri) =>
      jsonResource(uri.href, {
        tactic_statuses: TACTIC_STATUSES,
        tactic_priorities: TACTIC_PRIORITIES,
        project_statuses: PROJECT_STATUSES,
        lead_statuses: LEAD_STATUSES,
        leave_statuses: ['pending', 'approved', 'rejected'],
      }),
  )

  server.registerResource(
    'wsso-org-hierarchy',
    'wsso://org-hierarchy',
    {
      title: 'Org Hierarchy',
      description: 'Companies and teams visible to the connected user',
      mimeType: 'application/json',
    },
    async (uri, extra) => {
      try {
        const { supabase } = getMcpClient(extra)
        const [companies, teams] = await Promise.all([
          supabase.from('companies').select('id, name, code').order('name'),
          supabase.from('teams').select('id, name, company_id, manager_id').order('name'),
        ])
        if (companies.error) throw new Error(companies.error.message)
        if (teams.error) throw new Error(teams.error.message)
        return jsonResource(uri.href, {
          companies: companies.data ?? [],
          teams: teams.data ?? [],
        })
      } catch (err) {
        return jsonResource(uri.href, {
          error: err instanceof Error ? err.message : 'Failed to load hierarchy',
        })
      }
    },
  )
}
