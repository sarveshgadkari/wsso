'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Notification } from '@/lib/types'

export async function getNotifications(limit = 30): Promise<Notification[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as Notification[]
}

export async function markRead(id: string) {
  const supabase = await createClient()
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
  revalidatePath('/notifications')
  revalidatePath('/dashboard')
}

export async function markAllRead() {
  const supabase = await createClient()
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false)
  revalidatePath('/notifications')
  revalidatePath('/dashboard')
}

// ── Internal helper — called from other server actions only ───────────────────

export async function insertNotification(
  userId:  string,
  type:    string,
  message: string,
  link?:   string,
) {
  const { supabaseAdmin } = await import('@/lib/supabase/admin')
  await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    type,
    message,
    link: link ?? null,
  })
}
