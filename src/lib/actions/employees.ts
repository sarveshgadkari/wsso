'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { TIMEZONE_VALUES } from '@/lib/utils/timezones'

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
  await requireRole(['admin', 'manager'])
  const supabase = await createClient()

  const parsed = profileUpdateSchema.safeParse(input)
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0]
    return { error: msg ?? 'Invalid input' }
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
