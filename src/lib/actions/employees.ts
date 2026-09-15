'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { TIMEZONE_VALUES } from '@/lib/utils/timezones'
import { listVisibleProfileIds } from '@/lib/saas/team-scope'
import { supabaseAdmin } from '@/lib/supabase/admin'

const profileUpdateSchema = z.object({
  full_name:  z.string().min(1, 'Full name is required'),
  phone:      z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  role:       z.enum(['admin', 'director', 'manager', 'employee']),
  timezone:   z.enum(TIMEZONE_VALUES as [string, ...string[]]),
})

export async function updateEmployeeProfile(
  id: string,
  input: z.infer<typeof profileUpdateSchema>,
) {
  const viewer = await requireRole(['admin', 'manager'])
  const supabase = await createClient()

  const parsed = profileUpdateSchema.safeParse(input)
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0]
    return { error: msg ?? 'Invalid input' }
  }

  if (viewer.role === 'manager') {
    const allowed = await listVisibleProfileIds(viewer)
    if (!allowed?.includes(id)) {
      return { error: 'You can only edit people on your team' }
    }
  }

  // If demoting away from manager, ensure they don't still manage a team
  if (parsed.data.role !== 'manager') {
    const { data: current } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', id)
      .single()

    if (current?.role === 'manager') {
      const { count } = await supabase
        .from('teams')
        .select('id', { count: 'exact', head: true })
        .eq('manager_id', id)

      if ((count ?? 0) > 0) {
        return {
          error: 'Cannot change role: this person still manages a team. Reassign the team first.',
        }
      }
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/employees/${id}`)
  revalidatePath('/employees')
  return { data }
}

export async function setEmployeeStatus(id: string, status: 'active' | 'inactive') {
  await requireRole(['admin'])
  const supabase = await createClient()

  if (status === 'inactive') {
    const { count } = await supabase
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .eq('manager_id', id)

    if ((count ?? 0) > 0) {
      return {
        error: 'This employee still manages a team. Reassign the team before deactivating.',
      }
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/employees/${id}`)
  revalidatePath('/employees')
  return { data }
}

export async function deleteEmployeeProfile(id: string): Promise<{ error?: string }> {
  const viewer = await requireRole(['admin'])

  if (viewer.id === id) {
    return { error: 'You cannot delete your own profile.' }
  }

  const { data: target } = await supabaseAdmin
    .from('profiles')
    .select('id, role, organization_id, full_name')
    .eq('id', id)
    .maybeSingle()

  const orgId = viewer.organization_id
  if (!target || !orgId || target.organization_id !== orgId) {
    return { error: 'Employee not found' }
  }
  if (target.role === 'super_admin') {
    return { error: 'This account cannot be deleted.' }
  }

  if (target.role === 'admin') {
    const { count } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('role', 'admin')
      .eq('status', 'active')
      .neq('id', id)

    if ((count ?? 0) < 1) {
      return { error: 'Cannot delete the last active admin in this workspace.' }
    }
  }

  const { count: teamCount } = await supabaseAdmin
    .from('teams')
    .select('id', { count: 'exact', head: true })
    .eq('manager_id', id)

  if ((teamCount ?? 0) > 0) {
    return { error: 'This person still manages a team. Reassign the team before deleting.' }
  }

  const remap = await Promise.all([
    supabaseAdmin.from('tactics').update({ created_by: viewer.id }).eq('created_by', id),
    supabaseAdmin.from('documents').update({ uploaded_by: viewer.id }).eq('uploaded_by', id),
    supabaseAdmin.from('tactic_documents').update({ created_by: viewer.id }).eq('created_by', id),
    supabaseAdmin.from('announcements').update({ created_by: viewer.id }).eq('created_by', id),
    supabaseAdmin.from('training_modules').update({ created_by: viewer.id }).eq('created_by', id),
    supabaseAdmin.from('leave_requests').update({ reviewed_by: null }).eq('reviewed_by', id),
  ])
  const remapError = remap.find((r) => r.error)?.error
  if (remapError) {
    console.error('[deleteEmployee] remap failed:', remapError.message)
    return { error: 'Could not free this profile from existing records. Deactivate instead, or contact support.' }
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (error) {
    console.error('[deleteEmployee] deleteUser failed:', error.message)
    return { error: 'Could not delete this profile. Deactivate instead, or contact support.' }
  }

  revalidatePath('/employees')
  return {}
}
