'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'

const companySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(120),
})

export async function createCompany(input: { name: string }) {
  await requireRole(['admin'])
  const supabase = await createClient()

  const parsed = companySchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors.name?.[0] ?? 'Invalid input' }
  }

  const { data, error } = await supabase
    .from('companies')
    .insert({ name: parsed.data.name })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/companies')
  revalidatePath('/settings/hierarchy')
  return { data }
}

export async function updateCompany(id: string, input: { name: string }) {
  await requireRole(['admin'])
  const supabase = await createClient()

  const parsed = companySchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors.name?.[0] ?? 'Invalid input' }
  }

  const { data, error } = await supabase
    .from('companies')
    .update({ name: parsed.data.name })
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/companies')
  revalidatePath('/settings/hierarchy')
  return { data }
}

export async function deleteCompany(id: string) {
  await requireRole(['admin'])
  const supabase = await createClient()

  // Guard: prevent deletion if teams, projects, or clients still reference this company
  const [{ count: teamCount }, { count: projectCount }, { count: clientCount }] =
    await Promise.all([
      supabase.from('teams').select('id', { count: 'exact', head: true }).eq('company_id', id),
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('company_id', id),
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', id),
    ])

  const blockers: string[] = []
  if ((teamCount   ?? 0) > 0) blockers.push(`${teamCount} team(s)`)
  if ((projectCount ?? 0) > 0) blockers.push(`${projectCount} project(s)`)
  if ((clientCount  ?? 0) > 0) blockers.push(`${clientCount} client(s)`)

  if (blockers.length > 0) {
    return {
      error: `Cannot delete: this company still has ${blockers.join(', ')} linked to it. Remove or reassign them first.`,
    }
  }

  const { error } = await supabase.from('companies').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/companies')
  revalidatePath('/settings/hierarchy')
  return { data: { id } }
}
