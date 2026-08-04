import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMcpClient } from '../auth'
import { PaginationSchema, runTool, UuidSchema } from '../helpers'

export function registerNotificationTools(server: McpServer) {
  server.registerTool(
    'notifications_list',
    {
      title: 'List Notifications',
      description: 'List notifications for the connected employee.',
      inputSchema: {
        unread_only: z.boolean().optional().default(false),
        ...PaginationSchema,
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        let query = supabase
          .from('notifications')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .range(args.offset, args.offset + args.limit - 1)

        if (args.unread_only) query = query.eq('is_read', false)

        const { data, error } = await query
        if (error) throw new Error(error.message)

        const { count } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('is_read', false)

        return { unread_count: count ?? 0, notifications: data ?? [] }
      }),
  )

  server.registerTool(
    'notifications_mark_read',
    {
      title: 'Mark Notification Read',
      description: 'Mark one notification as read.',
      inputSchema: { id: UuidSchema },
    },
    async ({ id }, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', id)
          .eq('user_id', profile.id)
        if (error) throw new Error(error.message)
        return { ok: true }
      }),
  )

  server.registerTool(
    'announcements_list',
    {
      title: 'List Announcements',
      description:
        'List published announcements sent to the connected employee (inbox feed).',
      inputSchema: { ...PaginationSchema },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        const { data, error } = await supabase
          .from('announcements')
          .select('id, title, body, status, published_at, created_at, created_by')
          .eq('status', 'published')
          .contains('recipient_ids', [profile.id])
          .order('published_at', { ascending: false })
          .range(args.offset, args.offset + args.limit - 1)
        if (error) throw new Error(error.message)
        return { announcements: data ?? [] }
      }),
  )
}
