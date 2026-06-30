'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'

const orgSchema = z.object({
  employee_id: z.string().uuid(),
  team_id:     z.string().uuid().nullable(),
  manager_id:  z.string().uuid().nullable(),
  company_ids: z.array(z.string().uuid()),
})

export async function updateEmployeeOrg(input: z.infer<typeof orgSchema>) {
  await requireRole(['admin'])
  const supabase = await createClient()

  const parsed = orgSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid input' }

  const { employee_id, team_id, manager_id, company_ids } = parsed.data

  // Guard: if a team is selected, that team must already have a manager assigned
  if (team_id) {
    const { data: team } = await supabase
      .from('teams')
      .select('id, manager_id')
      .eq('id', team_id)
      .single()

    if (!team) return { error: 'Selected team does not exist.' }

    if (!team.manager_id && !manager_id) {
      return {
        error:
          'This team has no manager assigned yet. Assign a manager to the team first, or provide a direct manager override.',
      }
    }
  }

  // Update profile: team_id and manager_id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .update({ team_id: team_id ?? null, manager_id: manager_id ?? null })
    .eq('id', employee_id)
    .select()
    .single()

  if (profileError) return { error: profileError.message }

  // Sync employee_companies: delete all then re-insert
  const { error: deleteError } = await supabase
    .from('employee_companies')
    .delete()
    .eq('employee_id', employee_id)

  if (deleteError) return { error: deleteError.message }

  if (company_ids.length > 0) {
    const { error: insertError } = await supabase
      .from('employee_companies')
      .insert(company_ids.map((company_id) => ({ employee_id, company_id })))

    if (insertError) return { error: insertError.message }
  }

  // Revalidate every page that uses this employee's data
  revalidatePath('/settings/hierarchy')
  revalidatePath('/employees')
  revalidatePath('/dashboard')
  return { data: profile }
}
