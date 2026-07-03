'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireProfile, requireRole } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendAnnouncementEmail } from '@/lib/email/send-announcement-email'
import { insertNotification } from '@/lib/actions/notifications'
import type { Announcement, Profile } from '@/lib/types'

export interface AnnouncementRecipient {
  id:            string
  full_name:     string
  email:         string
  employee_code: string
}

export interface AnnouncementWithSender extends Announcement {
  sender: Pick<Profile, 'id' | 'full_name' | 'employee_code' | 'role'> | null
}

const composeSchema = z.object({
  title:         z.string().min(1, 'Subject is required').max(200),
  body:          z.string().min(1, 'Message is required').max(10000),
  recipientIds:  z.array(z.string().uuid()).min(1, 'Select at least one recipient'),
  sendEmail:     z.boolean(),
})

async function getManagedTeamMemberIds(managerId: string): Promise<string[]> {
  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('manager_id', managerId)

  const teamIds = (teams ?? []).map(t => t.id)
  if (teamIds.length === 0) return []

  const { data: members } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .in('team_id', teamIds)
    .eq('status', 'active')

  return (members ?? []).map(m => m.id)
}

type SenderInfo = Pick<Profile, 'id' | 'full_name' | 'employee_code' | 'role'>

function isValidRecipient(r: AnnouncementRecipient | null | undefined): r is AnnouncementRecipient {
  return !!(r?.id && r?.full_name && r?.email)
}

/** Resolve sender names via admin client — profile embeds fail under RLS for employees. */
async function enrichWithSenders(announcements: Announcement[]): Promise<AnnouncementWithSender[]> {
  if (announcements.length === 0) return []

  const creatorIds = Array.from(new Set(announcements.map(a => a.created_by)))
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, employee_code, role')
    .in('id', creatorIds)

  const byId = Object.fromEntries(
    ((profiles ?? []) as SenderInfo[]).map(p => [p.id, p]),
  )

  return announcements.map(a => ({
    ...a,
    sender: byId[a.created_by] ?? null,
  }))
}

async function assertRecipientsAllowed(
  sender: Profile,
  recipientIds: string[],
): Promise<{ ok: true } | { error: string }> {
  if (recipientIds.length === 0) {
    return { error: 'Select at least one recipient' }
  }

  if (sender.role === 'admin') {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .in('id', recipientIds)
      .eq('status', 'active')

    if ((data ?? []).length !== recipientIds.length) {
      return { error: 'One or more selected recipients are invalid or inactive' }
    }
    return { ok: true }
  }

  if (sender.role === 'manager') {
    const allowed = await getManagedTeamMemberIds(sender.id)
    const allowedSet = new Set(allowed)
    const invalid = recipientIds.filter(id => !allowedSet.has(id))
    if (invalid.length > 0) {
      return { error: 'You can only send announcements to your team members' }
    }
    return { ok: true }
  }

  return { error: 'Not allowed to send announcements' }
}

export async function getAnnouncementRecipients(): Promise<AnnouncementRecipient[]> {
  const profile = await requireRole(['admin', 'manager'])
  const supabase = await createClient()

  if (profile.role === 'admin') {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, employee_code')
      .eq('status', 'active')
      .neq('id', profile.id)
      .order('full_name')

    return (data ?? []).filter(isValidRecipient) as AnnouncementRecipient[]
  }

  const teamMemberIds = await getManagedTeamMemberIds(profile.id)
  if (teamMemberIds.length === 0) return []

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, employee_code')
    .in('id', teamMemberIds)
    .eq('status', 'active')
    .neq('id', profile.id)
    .order('full_name')

  return (data ?? []).filter(isValidRecipient) as AnnouncementRecipient[]
}

export async function getReceivedAnnouncements(): Promise<AnnouncementWithSender[]> {
  const profile = await requireProfile()
  const supabase = await createClient()

  const { data } = await supabase
    .from('announcements')
    .select('*')
    .eq('status', 'published')
    .contains('recipient_ids', [profile.id])
    .order('published_at', { ascending: false })
    .limit(50)

  return enrichWithSenders((data ?? []) as Announcement[])
}

export async function getSentAnnouncements(): Promise<AnnouncementWithSender[]> {
  const profile = await requireRole(['admin', 'manager'])
  const supabase = await createClient()

  const { data } = await supabase
    .from('announcements')
    .select('*')
    .eq('created_by', profile.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return enrichWithSenders((data ?? []) as Announcement[])
}

export async function getAnnouncementDrafts(): Promise<Announcement[]> {
  const profile = await requireRole(['admin', 'manager'])
  const supabase = await createClient()

  const { data } = await supabase
    .from('announcements')
    .select('*')
    .eq('created_by', profile.id)
    .eq('status', 'draft')
    .order('updated_at', { ascending: false })

  return (data ?? []) as Announcement[]
}

export async function saveAnnouncementDraft(input: {
  id?:           string
  title:         string
  body:          string
  recipientIds:  string[]
  sendEmail:     boolean
}) {
  const profile = await requireRole(['admin', 'manager'])

  const parsed = composeSchema.safeParse(input)
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0]
    return { error: msg ?? 'Invalid input' }
  }

  const allowed = await assertRecipientsAllowed(profile, parsed.data.recipientIds)
  if ('error' in allowed) return { error: allowed.error }

  const supabase = await createClient()
  const row = {
    title:         parsed.data.title,
    body:          parsed.data.body,
    recipient_ids: parsed.data.recipientIds,
    send_email:    parsed.data.sendEmail,
    status:        'draft' as const,
    created_by:    profile.id,
  }

  if (input.id) {
    const { data: existing } = await supabase
      .from('announcements')
      .select('id, status, created_by')
      .eq('id', input.id)
      .single()

    if (!existing || existing.created_by !== profile.id || existing.status !== 'draft') {
      return { error: 'Draft not found' }
    }

    const { data, error } = await supabase
      .from('announcements')
      .update(row)
      .eq('id', input.id)
      .select()
      .single()

    if (error) return { error: error.message }
    revalidatePath('/announcements')
    return { data: data as Announcement }
  }

  const { data, error } = await supabase
    .from('announcements')
    .insert(row)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/announcements')
  return { data: data as Announcement }
}

export async function publishAnnouncement(input: {
  id?:           string
  title:         string
  body:          string
  recipientIds:  string[]
  sendEmail:     boolean
}) {
  const profile = await requireRole(['admin', 'manager'])

  const parsed = composeSchema.safeParse(input)
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0]
    return { error: msg ?? 'Invalid input' }
  }

  const allowed = await assertRecipientsAllowed(profile, parsed.data.recipientIds)
  if ('error' in allowed) return { error: allowed.error }

  const supabase = await createClient()
  const now = new Date().toISOString()

  const publishRow = {
    title:         parsed.data.title,
    body:          parsed.data.body,
    recipient_ids: parsed.data.recipientIds,
    send_email:    parsed.data.sendEmail,
    status:        'published' as const,
    published_at:  now,
    created_by:    profile.id,
  }

  let announcement: Announcement

  if (input.id) {
    const { data: existing } = await supabase
      .from('announcements')
      .select('id, status, created_by')
      .eq('id', input.id)
      .single()

    if (!existing || existing.created_by !== profile.id || existing.status !== 'draft') {
      return { error: 'Draft not found' }
    }

    const { data, error } = await supabase
      .from('announcements')
      .update({ ...publishRow, email_sent_at: null })
      .eq('id', input.id)
      .select()
      .single()

    if (error || !data) return { error: error?.message ?? 'Failed to publish' }
    announcement = data as Announcement
  } else {
    const { data, error } = await supabase
      .from('announcements')
      .insert(publishRow)
      .select()
      .single()

    if (error || !data) return { error: error?.message ?? 'Failed to publish' }
    announcement = data as Announcement
  }

  const { data: recipients } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .in('id', parsed.data.recipientIds)
    .eq('status', 'active')

  const recipientList = recipients ?? []
  const notifMessage = `${profile.full_name}: ${parsed.data.title}`

  await Promise.all(
    recipientList.map(r =>
      insertNotification(r.id, 'announcement', notifMessage, '/announcements'),
    ),
  )

  let emailWarning: string | undefined
  if (parsed.data.sendEmail) {
    const emails = recipientList.map(r => r.email).filter(Boolean)
    const emailResult = await sendAnnouncementEmail({
      subject: parsed.data.title,
      body:    parsed.data.body,
      bcc:     emails,
    })

    if (emailResult.sent) {
      await supabaseAdmin
        .from('announcements')
        .update({ email_sent_at: now })
        .eq('id', announcement.id)
    } else {
      emailWarning = emailResult.error ?? 'Email could not be sent'
    }
  }

  revalidatePath('/announcements')
  revalidatePath('/dashboard')
  revalidatePath('/notifications')

  return {
    data: announcement,
    emailWarning,
  }
}

export async function deleteAnnouncementDraft(id: string) {
  const profile = await requireRole(['admin', 'manager'])
  const supabase = await createClient()

  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id)
    .eq('created_by', profile.id)
    .eq('status', 'draft')

  if (error) return { error: error.message }
  revalidatePath('/announcements')
  return { data: true }
}