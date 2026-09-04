'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth/session'
import { requireOrgId } from '@/lib/saas/tenant'
import { resolveStickyNotePage, type StickyNoteColor } from '@/lib/sticky-notes/pages'
import type { StickyNote } from '@/lib/types'

const COLORS: StickyNoteColor[] = ['yellow', 'pink', 'blue', 'green', 'orange']

function revalidateNotes() {
  revalidatePath('/', 'layout')
}

export async function listStickyNotes(): Promise<StickyNote[]> {
  const profile = await requireProfile()
  const orgId = requireOrgId(profile)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sticky_notes')
    .select('*')
    .eq('organization_id', orgId)
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[sticky_notes] list', error.message)
    return []
  }
  return (data ?? []) as StickyNote[]
}

export async function createStickyNote(pathname: string): Promise<{ data?: StickyNote; error?: string }> {
  const profile = await requireProfile()
  const orgId = requireOrgId(profile)
  const page = resolveStickyNotePage(pathname)
  const supabase = await createClient()

  const { count } = await supabase
    .from('sticky_notes')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profile.id)
    .eq('page_path', page.path)

  const n = count ?? 0
  const { data, error } = await supabase
    .from('sticky_notes')
    .insert({
      organization_id: orgId,
      profile_id: profile.id,
      page_path: page.path,
      page_label: page.label,
      title: '',
      body: '',
      color: COLORS[n % COLORS.length],
      pos_x: 48 + (n % 5) * 28,
      pos_y: 64 + (n % 5) * 28,
      z_index: n + 1,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidateNotes()
  return { data: data as StickyNote }
}

export async function updateStickyNote(
  id: string,
  patch: {
    title?: string
    body?: string
    color?: StickyNoteColor
    pos_x?: number
    pos_y?: number
    z_index?: number
    minimized?: boolean
  },
): Promise<{ error?: string }> {
  const profile = await requireProfile()
  const supabase = await createClient()

  const next: Record<string, unknown> = {}
  if (typeof patch.title === 'string') next.title = patch.title.slice(0, 120)
  if (typeof patch.body === 'string') next.body = patch.body.slice(0, 8000)
  if (patch.color && COLORS.includes(patch.color)) next.color = patch.color
  if (typeof patch.pos_x === 'number') next.pos_x = Math.max(0, Math.round(patch.pos_x))
  if (typeof patch.pos_y === 'number') next.pos_y = Math.max(0, Math.round(patch.pos_y))
  if (typeof patch.z_index === 'number') next.z_index = Math.max(1, Math.round(patch.z_index))
  if (typeof patch.minimized === 'boolean') next.minimized = patch.minimized

  if (Object.keys(next).length === 0) return {}

  const { error } = await supabase
    .from('sticky_notes')
    .update(next)
    .eq('id', id)
    .eq('profile_id', profile.id)

  if (error) return { error: error.message }
  revalidateNotes()
  return {}
}

export async function deleteStickyNote(id: string): Promise<{ error?: string }> {
  const profile = await requireProfile()
  const supabase = await createClient()
  const { error } = await supabase
    .from('sticky_notes')
    .delete()
    .eq('id', id)
    .eq('profile_id', profile.id)

  if (error) return { error: error.message }
  revalidateNotes()
  return {}
}
