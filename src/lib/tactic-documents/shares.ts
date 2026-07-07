import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireProfile } from '@/lib/auth/session'

export interface TacticDocShareRow {
  id:          string
  shared_with: string
  created_at:  string
  user:        { id: string; full_name: string; employee_code: string; role: string }
}

export async function fetchTacticDocumentShares(docId: string): Promise<TacticDocShareRow[]> {
  const profile = await requireProfile()
  const supabase = await createClient()

  const { data: doc } = await supabase
    .from('tactic_documents')
    .select('created_by')
    .eq('id', docId)
    .single()

  if (!doc) return []
  if (doc.created_by !== profile.id && profile.role !== 'admin') return []

  const { data, error } = await supabaseAdmin
    .from('tactic_document_shares')
    .select(`
      id, shared_with, created_at,
      user:profiles!tactic_document_shares_shared_with_fkey(id, full_name, employee_code, role)
    `)
    .eq('tactic_document_id', docId)
    .order('created_at', { ascending: false })

  if (error) return []
  return (data ?? []) as unknown as TacticDocShareRow[]
}
