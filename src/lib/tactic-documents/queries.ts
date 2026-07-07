import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Profile } from '@/lib/types'

export interface TacticDocListRow {
  id:              string
  code:            string
  date_of_meeting: string | null
  purpose:         string
  facilitator:     string | null
  status:          string
  created_at:      string
  created_by:      string
  creator:         { id: string; full_name: string; role: string } | null
  company:         { name: string } | null
  project:         { name: string; code: string } | null
}

async function directReportIds(managerId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('manager_id', managerId)
    .eq('status', 'active')
  return (data ?? []).map(p => p.id)
}

async function sharedTacticDocumentIds(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('tactic_document_shares')
    .select('tactic_document_id')
    .eq('shared_with', userId)
  return (data ?? []).map(s => s.tactic_document_id)
}

/** Who can see which TACTIC document IDs (bypasses RLS — use only after auth). */
export async function visibleTacticDocumentIds(profile: Profile): Promise<string[] | 'all'> {
  if (profile.role === 'admin' || profile.role === 'director') return 'all'

  if (profile.role === 'manager') {
    const reportIds = await directReportIds(profile.id)
    const sharedIds = await sharedTacticDocumentIds(profile.id)
    const ids = new Set<string>(sharedIds)

    const { data: own } = await supabaseAdmin
      .from('tactic_documents')
      .select('id')
      .eq('created_by', profile.id)
    ;(own ?? []).forEach(d => ids.add(d.id))

    if (reportIds.length > 0) {
      const { data: teamDocs } = await supabaseAdmin
        .from('tactic_documents')
        .select('id')
        .in('created_by', reportIds)
      ;(teamDocs ?? []).forEach(d => ids.add(d.id))
    }

    return Array.from(ids)
  }

  if (profile.role === 'employee') {
    const sharedIds = await sharedTacticDocumentIds(profile.id)
    const { data: own } = await supabaseAdmin
      .from('tactic_documents')
      .select('id')
      .eq('created_by', profile.id)
    const ownIds = (own ?? []).map(d => d.id)
    return Array.from(new Set([...ownIds, ...sharedIds]))
  }

  return []
}

export async function countPendingTacticDocuments(profile: Profile): Promise<number> {
  try {
    if (profile.role === 'admin' || profile.role === 'director') {
      const { count, error } = await supabaseAdmin
        .from('tactic_documents')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'submitted')
      if (error) return 0
      return count ?? 0
    }

    if (profile.role === 'manager') {
      const reportIds = await directReportIds(profile.id)
      if (!reportIds.length) return 0
      const { count, error } = await supabaseAdmin
        .from('tactic_documents')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'submitted')
        .in('created_by', reportIds)
      if (error) return 0
      return count ?? 0
    }

    return 0
  } catch {
    return 0
  }
}

export async function fetchTacticDocumentsForProfile(
  profile: Profile,
): Promise<TacticDocListRow[]> {
  try {
    const visible = await visibleTacticDocumentIds(profile)

    let query = supabaseAdmin
      .from('tactic_documents')
      .select(`
        id, code, date_of_meeting, purpose, facilitator, status, created_at, created_by,
        creator:profiles!tactic_documents_created_by_fkey(id, full_name, role),
        company:companies!tactic_documents_company_id_fkey(name),
        project:projects!tactic_documents_project_id_fkey(name, code)
      `)
      .order('created_at', { ascending: false })
      .limit(300)

    if (visible !== 'all') {
      if (!visible.length) return []
      query = query.in('id', visible)
    }

    const { data, error } = await query
    if (error) return []
    return (data ?? []) as unknown as TacticDocListRow[]
  } catch {
    return []
  }
}

export async function canViewTacticDocument(
  profile: Profile,
  docId: string,
  createdBy: string,
): Promise<boolean> {
  if (profile.role === 'admin' || profile.role === 'director') return true
  if (createdBy === profile.id) return true
  if (profile.role === 'manager') {
    const reports = await directReportIds(profile.id)
    if (reports.includes(createdBy)) return true
  }
  const shared = await sharedTacticDocumentIds(profile.id)
  return shared.includes(docId)
}

export async function fetchTacticDocumentById(docId: string) {
  const { data, error } = await supabaseAdmin
    .from('tactic_documents')
    .select(`
      id, code,
      date_of_meeting, time_of_meeting, facilitator, location, attendees,
      purpose, background_info, takeaways,
      status, reviewer_id, review_note, submitted_at, reviewed_at,
      created_by, created_at,
      creator:profiles!tactic_documents_created_by_fkey(id, full_name, role, employee_code, manager_id),
      reviewer:profiles!tactic_documents_reviewer_id_fkey(id, full_name, role),
      company:companies!tactic_documents_company_id_fkey(id, name, code),
      project:projects!tactic_documents_project_id_fkey(id, name, code)
    `)
    .eq('id', docId)
    .single()

  if (error || !data) return null
  return data
}

export async function fetchTacticDocumentTasks(docId: string) {
  const { data } = await supabaseAdmin
    .from('tactic_tasks')
    .select(`
      id, order_no, title, description, status,
      assigned_to, owner_name, target_date,
      assignee:profiles!tactic_tasks_assigned_to_fkey(full_name)
    `)
    .eq('tactic_document_id', docId)
    .order('order_no')
  return data ?? []
}

export async function fetchTacticDocumentNextSteps(docId: string) {
  const { data } = await supabaseAdmin
    .from('tactic_next_steps')
    .select(`
      id, order_no, description, owner, owner_name, due_date, completed,
      owner_profile:profiles!tactic_next_steps_owner_fkey(full_name)
    `)
    .eq('tactic_document_id', docId)
    .order('order_no')
  return data ?? []
}
