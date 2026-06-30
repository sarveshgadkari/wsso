'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/session'
// Writes go through supabaseAdmin because the clients RLS only gives managers SELECT.
// Role is already verified in requireRole(), so this is safe.
import { supabaseAdmin } from '@/lib/supabase/admin'

const clientSchema = z.object({
  name:          z.string().min(1, 'Client name is required'),
  company_id:    z.string().uuid('Select a company'),
  contact_name:  z.string().optional().nullable(),
  contact_email: z.string().email('Enter a valid email').optional().or(z.literal('')).nullable(),
  contact_phone: z.string().optional().nullable(),
})

const updateSchema = clientSchema.extend({
  status: z.enum(['active', 'inactive']).optional(),
})

export async function addClient(input: z.infer<typeof clientSchema>) {
  await requireRole(['admin', 'manager'])

  const parsed = clientSchema.safeParse(input)
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0]
    return { error: msg ?? 'Invalid input' }
  }

  const { data, error } = await supabaseAdmin
    .from('clients')
    .insert({
      ...parsed.data,
      contact_email: parsed.data.contact_email || null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/clients')
  return { data }
}

export async function updateClient(id: string, input: z.infer<typeof updateSchema>) {
  await requireRole(['admin', 'manager'])

  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0]
    return { error: msg ?? 'Invalid input' }
  }

  const { data, error } = await supabaseAdmin
    .from('clients')
    .update({
      ...parsed.data,
      contact_email: parsed.data.contact_email || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/clients')
  revalidatePath(`/projects`)
  return { data }
}
