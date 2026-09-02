'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireProfile, requireRole } from '@/lib/auth/session'
import type { LeadStatus } from '@/lib/types'
import { LEAD_STATUSES } from '@/lib/types'

const optionalText = (max: number) =>
  z.preprocess(
    (v) => {
      if (v === undefined || v === null) return null
      if (typeof v !== 'string') return v
      const t = v.trim()
      return t === '' ? null : t
    },
    z.string().max(max).nullable(),
  )

function revalidateLeadPaths() {
  revalidatePath('/crm')
  revalidatePath('/my-leads')
  revalidatePath('/dashboard')
}

export type LeadCreateInput = {
  first_name: string
  last_name: string
  email: string
  company?: string | null
  inquiry_type?: string | null
  message?: string | null
  source?: string | null
  status?: LeadStatus
}

const leadCreateSchema = z.object({
  first_name:   z.string().trim().min(1, 'First name is required').max(80),
  last_name:    z.string().trim().min(1, 'Last name is required').max(80),
  email:        z.string().trim().email('Enter a valid email').max(200),
  company:      optionalText(200),
  inquiry_type: optionalText(120),
  message:      z.string().trim().max(5000).optional().nullable(),
  source:       optionalText(80),
  status:       z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']).optional(),
})

function dashboardSourceUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://wsso.tlbisbig.world').replace(/\/$/, '')
}

export async function createLead(raw: LeadCreateInput) {
  const profile = await requireRole(['admin'])
  if (!profile.organization_id) throw new Error('No workspace')

  const parsed = leadCreateSchema.safeParse(raw)
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors
    throw new Error(
      flat.first_name?.[0] ??
      flat.last_name?.[0] ??
      flat.email?.[0] ??
      'Invalid input',
    )
  }

  const { data, error } = await supabaseAdmin
    .from('leads')
    .insert({
      website_name:  'WSSO',
      website_url:   dashboardSourceUrl(),
      first_name:    parsed.data.first_name,
      last_name:     parsed.data.last_name,
      email:         parsed.data.email,
      company:       parsed.data.company,
      inquiry_type:  parsed.data.inquiry_type,
      message:       parsed.data.message?.trim() || 'Added from WSSO dashboard.',
      source:        parsed.data.source ?? 'dashboard',
      status:        parsed.data.status ?? 'new',
      organization_id: profile.organization_id,
    } as never)
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  revalidateLeadPaths()
  return { id: data.id }
}

export async function bulkCreateLeads(rows: LeadCreateInput[]) {
  const profile = await requireRole(['admin'])
  if (!profile.organization_id) throw new Error('No workspace')
  if (rows.length === 0) throw new Error('No rows to import')
  if (rows.length > 500) throw new Error('Import up to 500 leads at a time')

  const errors: { row: number; message: string }[] = []
  const valid: LeadCreateInput[] = []

  rows.forEach((raw, i) => {
    const parsed = leadCreateSchema.safeParse(raw)
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors
      errors.push({
        row: i + 2,
        message:
          flat.first_name?.[0] ??
          flat.last_name?.[0] ??
          flat.email?.[0] ??
          'Invalid row',
      })
      return
    }
    valid.push(parsed.data)
  })

  if (valid.length === 0) {
    return { created: 0, skipped: errors.length, errors }
  }

  let created = 0
  const CHUNK = 100
  for (let i = 0; i < valid.length; i += CHUNK) {
    const slice = valid.slice(i, i + CHUNK)
    const { data, error } = await supabaseAdmin
      .from('leads')
      .insert(
        slice.map((p) => ({
          website_name:  'WSSO',
          website_url:   dashboardSourceUrl(),
          first_name:    p.first_name,
          last_name:     p.last_name,
          email:         p.email,
          company:       p.company,
          inquiry_type:  p.inquiry_type,
          message:       p.message?.trim() || 'Imported from CSV.',
          source:        p.source ?? 'csv_import',
          status:        p.status ?? 'new',
          organization_id: profile.organization_id,
        })) as never,
      )
      .select('id')
    if (error) throw new Error(error.message)
    created += data?.length ?? slice.length
  }

  revalidateLeadPaths()
  return { created, skipped: errors.length, errors }
}

// ── Admin: list active users a lead can be assigned to ──────────────────────

export async function getAssignableUsers(leadId: string) {
  await requireRole(['admin'])

  const { data: existing } = await supabaseAdmin
    .from('lead_assignments')
    .select('employee_id')
    .eq('lead_id', leadId)

  const alreadyAssigned = new Set((existing ?? []).map(r => r.employee_id))

  const { data: users, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, employee_code, role')
    .eq('status', 'active')
    .order('full_name')

  if (error) throw new Error(error.message)

  return (users ?? []).filter(u => !alreadyAssigned.has(u.id)) as {
    id: string; full_name: string; employee_code: string; role: string
  }[]
}

// ── Admin: assign / unassign ─────────────────────────────────────────────────

export async function assignLead(leadId: string, employeeId: string) {
  const profile = await requireRole(['admin'])

  const { data: target } = await supabaseAdmin
    .from('profiles')
    .select('id, status')
    .eq('id', employeeId)
    .single()

  if (!target || target.status !== 'active') throw new Error('User not found')

  const { data, error } = await supabaseAdmin.from('lead_assignments').insert({
    lead_id:     leadId,
    employee_id: employeeId,
    assigned_by: profile.id,
  }).select('id, created_at').single()

  if (error) {
    if (error.code === '23505') throw new Error('Already assigned to this person')
    throw new Error(error.message)
  }

  revalidateLeadPaths()
  return data
}

export async function unassignLead(assignmentId: string) {
  await requireRole(['admin'])

  const { error } = await supabaseAdmin
    .from('lead_assignments')
    .delete()
    .eq('id', assignmentId)

  if (error) throw new Error(error.message)

  revalidateLeadPaths()
}

// ── Update status — admin, or an employee assigned to the lead ──────────────

export async function updateLeadStatus(leadId: string, status: LeadStatus) {
  const profile = await requireProfile()

  if (!LEAD_STATUSES.includes(status)) throw new Error('Invalid status')

  if (profile.role !== 'admin') {
    const { data: assignment } = await supabaseAdmin
      .from('lead_assignments')
      .select('id')
      .eq('lead_id', leadId)
      .eq('employee_id', profile.id)
      .maybeSingle()

    if (!assignment) throw new Error('Not authorized')
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('leads')
    .update({ status })
    .eq('id', leadId)

  if (error) throw new Error(error.message)

  revalidateLeadPaths()
}

// ── Admin: edit lead contact / enquiry details ───────────────────────────────

const leadEditSchema = z.object({
  first_name:   z.string().trim().min(1, 'First name is required').max(80),
  last_name:    z.string().trim().min(1, 'Last name is required').max(80),
  email:        z.string().trim().email('Enter a valid email').max(200),
  company:      optionalText(200),
  inquiry_type: optionalText(120),
  message:      z.string().trim().min(1, 'Message is required').max(5000),
  status:       z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']),
})

export type LeadEditInput = z.infer<typeof leadEditSchema>

export async function updateLead(leadId: string, raw: LeadEditInput) {
  await requireRole(['admin'])

  const parsed = leadEditSchema.safeParse(raw)
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors
    throw new Error(
      flat.first_name?.[0] ??
      flat.last_name?.[0] ??
      flat.email?.[0] ??
      flat.message?.[0] ??
      flat.status?.[0] ??
      'Invalid input',
    )
  }

  const { error } = await supabaseAdmin
    .from('leads')
    .update({
      first_name:   parsed.data.first_name,
      last_name:    parsed.data.last_name,
      email:        parsed.data.email,
      company:      parsed.data.company,
      inquiry_type: parsed.data.inquiry_type,
      message:      parsed.data.message,
      status:       parsed.data.status,
    })
    .eq('id', leadId)

  if (error) throw new Error(error.message)

  revalidateLeadPaths()
  return { id: leadId }
}
