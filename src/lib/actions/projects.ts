'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'

const projectSchema = z.object({
  name:       z.string().min(1, 'Project name is required'),
  company_id: z.string().uuid('Select a company'),
  client_id:  z.string().uuid().nullable().optional(),
  manager_id: z.string().uuid().nullable().optional(),
  status:     z.enum(['active', 'on_hold', 'completed']).default('active'),
})

export async function addProject(input: z.infer<typeof projectSchema>) {
  const profile = await requireRole(['admin', 'manager'])
  const supabase = await createClient()

  const parsed = projectSchema.safeParse(input)
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0]
    return { error: msg ?? 'Invalid input' }
  }

  // Managers must own the project they create (enforced by RLS WITH CHECK)
  const payload = {
    ...parsed.data,
    client_id:  parsed.data.client_id  ?? null,
    manager_id: profile.role === 'manager' ? profile.id : (parsed.data.manager_id ?? null),
  }

  const { data, error } = await supabase
    .from('projects')
    .insert(payload)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/projects')
  return { data }
}

export async function updateProject(id: string, input: z.infer<typeof projectSchema>) {
  const profile = await requireRole(['admin', 'manager'])
  const supabase = await createClient()

  const parsed = projectSchema.safeParse(input)
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0]
    return { error: msg ?? 'Invalid input' }
  }

  // Managers can only update projects where manager_id = their own id (RLS enforces this)
  const payload = {
    ...parsed.data,
    client_id:  parsed.data.client_id  ?? null,
    manager_id: profile.role === 'manager' ? profile.id : (parsed.data.manager_id ?? null),
  }

  const { data, error } = await supabase
    .from('projects')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/projects')
  revalidatePath(`/projects/${id}`)
  return { data }
}
