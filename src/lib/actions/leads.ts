'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireProfile, requireRole } from '@/lib/auth/session'
import type { LeadStatus } from '@/lib/types'
import { LEAD_STATUSES } from '@/lib/types'

function revalidateLeadPaths() {
  revalidatePath('/crm')
  revalidatePath('/my-leads')
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

  const { error } = await supabaseAdmin.from('lead_assignments').insert({
    lead_id:     leadId,
    employee_id: employeeId,
    assigned_by: profile.id,
  })

  if (error) {
    if (error.code === '23505') throw new Error('Already assigned to this person')
    throw new Error(error.message)
  }

  revalidateLeadPaths()
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
