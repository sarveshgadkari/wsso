'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'

const emptyToNull = (v: unknown) => {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') return v
  const t = v.trim()
  return t === '' ? null : t
}

const companySchema = z.object({
  name:              z.string().min(1, 'Company name is required').max(120),
  ein_number:        z.preprocess(emptyToNull, z.string().max(32).nullable()),
  physical_address:  z.preprocess(emptyToNull, z.string().max(500).nullable()),
  mailing_address:   z.preprocess(emptyToNull, z.string().max(500).nullable()),
  phone:             z.preprocess(emptyToNull, z.string().max(40).nullable()),
  email:             z.preprocess(
    emptyToNull,
    z.string().email('Enter a valid email').max(200).nullable(),
  ),
})

export type CompanyInput = z.infer<typeof companySchema>

function firstError(parsed: z.SafeParseError<CompanyInput>) {
  const flat = parsed.error.flatten().fieldErrors
  return (
    flat.name?.[0] ??
    flat.ein_number?.[0] ??
    flat.physical_address?.[0] ??
    flat.mailing_address?.[0] ??
    flat.phone?.[0] ??
    flat.email?.[0] ??
    'Invalid input'
  )
}

export async function createCompany(input: CompanyInput) {
  await requireRole(['admin'])
  const supabase = await createClient()

  const parsed = companySchema.safeParse(input)
  if (!parsed.success) {
    return { error: firstError(parsed) }
  }

  const { data, error } = await supabase
    .from('companies')
    .insert({
      name:             parsed.data.name,
      ein_number:       parsed.data.ein_number,
      physical_address: parsed.data.physical_address,
      mailing_address:  parsed.data.mailing_address,
      phone:            parsed.data.phone,
      email:            parsed.data.email,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/companies')
  revalidatePath('/settings/hierarchy')
  return { data }
}

export async function updateCompany(id: string, input: CompanyInput) {
  await requireRole(['admin'])
  const supabase = await createClient()

  const parsed = companySchema.safeParse(input)
  if (!parsed.success) {
    return { error: firstError(parsed) }
  }

  const { data, error } = await supabase
    .from('companies')
    .update({
      name:             parsed.data.name,
      ein_number:       parsed.data.ein_number,
      physical_address: parsed.data.physical_address,
      mailing_address:  parsed.data.mailing_address,
      phone:            parsed.data.phone,
      email:            parsed.data.email,
    })
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
