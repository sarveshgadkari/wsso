'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'

const teamSchema = z.object({
  name:       z.string().min(1, 'Team name is required').max(100),
  company_id: z.string().uuid('Select a company'),
  manager_id: z.string().uuid().optional().nullable(),
})

/** Generate the next team code: TM001, TM002, … */
async function nextTeamCode(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { count } = await supabase
    .from('teams')
    .select('id', { count: 'exact', head: true })
  const n = (count ?? 0) + 1
  return `TM${String(n).padStart(3, '0')}`
}

export async function createTeam(input: z.infer<typeof teamSchema>) {
  await requireRole(['admin'])
  const supabase = await createClient()

  const parsed = teamSchema.safeParse(input)
  if (!parsed.success) {
    const errs = parsed.error.flatten().fieldErrors
    return { error: errs.name?.[0] ?? errs.company_id?.[0] ?? 'Invalid input' }
  }

  // Validate: manager must exist and have role=manager if provided
  if (parsed.data.manager_id) {
    const { data: mgr } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', parsed.data.manager_id)
      .single()

    if (!mgr) return { error: 'Selected manager does not exist.' }
    if (mgr.role !== 'manager') return { error: 'The assigned person must have the Manager role.' }
  }

  const code = await nextTeamCode(supabase)

  const { data, error } = await supabase
    .from('teams')
    .insert({ ...parsed.data, code })
    .select(`*, company:companies(id,name,code), manager:profiles!manager_id(id,full_name,employee_code)`)
    .single()

  if (error) return { error: error.message }

  revalidatePath('/settings/hierarchy')
  return { data }
}

export async function updateTeam(id: string, input: z.infer<typeof teamSchema>) {
  await requireRole(['admin'])
  const supabase = await createClient()

  const parsed = teamSchema.safeParse(input)
  if (!parsed.success) {
    const errs = parsed.error.flatten().fieldErrors
    return { error: errs.name?.[0] ?? errs.company_id?.[0] ?? 'Invalid input' }
  }

  if (parsed.data.manager_id) {
    const { data: mgr } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', parsed.data.manager_id)
      .single()

    if (!mgr) return { error: 'Selected manager does not exist.' }
    if (mgr.role !== 'manager') return { error: 'The assigned person must have the Manager role.' }
  }

  const { data, error } = await supabase
    .from('teams')
    .update({
      name:       parsed.data.name,
      company_id: parsed.data.company_id,
      manager_id: parsed.data.manager_id ?? null,
    })
    .eq('id', id)
    .select(`*, company:companies(id,name,code), manager:profiles!manager_id(id,full_name,employee_code)`)
    .single()

  if (error) return { error: error.message }

  revalidatePath('/settings/hierarchy')
  return { data }
}

export async function deleteTeam(id: string) {
  await requireRole(['admin'])
  const supabase = await createClient()

  // Guard: prevent deletion if employees are still assigned
  const { count: memberCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', id)

  if ((memberCount ?? 0) > 0) {
    return {
      error: `Cannot delete: ${memberCount} employee(s) are still assigned to this team. Reassign them first.`,
    }
  }

  const { error } = await supabase.from('teams').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/settings/hierarchy')
  return { data: { id } }
}
