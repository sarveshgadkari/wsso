import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMcpClient } from '../auth'
import { PaginationSchema, runTool, UuidSchema } from '../helpers'

export function registerDocumentTools(server: McpServer) {
  server.registerTool(
    'documents_list',
    {
      title: 'List Documents',
      description:
        'List documents visible to the connected user. Optional filters by project/tactic/employee codes.',
      inputSchema: {
        project_code: z.string().optional(),
        tactic_code: z.string().optional(),
        employee_code: z.string().optional(),
        company_code: z.string().optional(),
        ...PaginationSchema,
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase } = getMcpClient(extra)
        let query = supabase
          .from('documents')
          .select(
            'id, file_name, source_type, file_path, external_url, project_code, tactic_code, employee_code, company_code, uploaded_by, created_at',
          )
          .order('created_at', { ascending: false })
          .range(args.offset, args.offset + args.limit - 1)

        if (args.project_code) query = query.eq('project_code', args.project_code)
        if (args.tactic_code) query = query.eq('tactic_code', args.tactic_code)
        if (args.employee_code) query = query.eq('employee_code', args.employee_code)
        if (args.company_code) query = query.eq('company_code', args.company_code)

        const { data, error } = await query
        if (error) throw new Error(error.message)
        return { documents: data ?? [] }
      }),
  )

  server.registerTool(
    'documents_get',
    {
      title: 'Get Document',
      description: 'Get document metadata and a signed URL when it is a stored file.',
      inputSchema: { id: UuidSchema },
    },
    async ({ id }, extra) =>
      runTool(async () => {
        const { supabase } = getMcpClient(extra)
        const { data: doc, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', id)
          .single()
        if (error) throw new Error(error.message)

        let signed_url: string | null = null
        if (doc.source_type === 'file' && doc.file_path) {
          const { data: signed } = await supabase.storage
            .from('documents')
            .createSignedUrl(doc.file_path, 60 * 30)
          signed_url = signed?.signedUrl ?? null
        }

        return {
          document: doc,
          signed_url,
          external_url: doc.source_type === 'link' ? doc.external_url : null,
        }
      }),
  )
}
