import { notFound } from 'next/navigation'
import { requireProfile, getOrganization } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { TacticDetail } from '@/components/tactics/TacticDetail'
import type { TacticRow } from '@/components/tactics/TacticDialog'
import type { ActivityLogRow } from '@/components/tactics/ActivityTimeline'
import { enrichTacticRows, enrichActivityLogActors } from '@/lib/tactics/enrich-profiles'
import { getDocuments } from '@/lib/actions/documents'
import { listChecklistTemplates } from '@/lib/actions/workspace'
import { getTacticJobCost, listTacticChecklist } from '@/lib/actions/ops'
import { mergeWorkspaceSettings } from '@/lib/workspace/settings'

interface Props {
  params: { id: string }
}

export async function generateMetadata() {
  return { title: `Work Order — WSSO` }
}

export default async function TacticDetailPage({ params }: Props) {
  const profile  = await requireProfile()
  const supabase = await createClient()
  const isAdmin   = profile.role === 'admin'
  const isManager = profile.role === 'manager'

  const [tacticRes, logsRes, employeesRes, projectsRes] = await Promise.all([
    supabase
      .from('tactics')
      .select(`
        *,
        project:projects!tactics_project_id_fkey(id, name, code),
        assignee:profiles!tactics_assigned_to_fkey(id, full_name, employee_code),
        creator:profiles!tactics_created_by_fkey(id, full_name, employee_code)
      `)
      .eq('id', params.id)
      .single(),

    supabase
      .from('activity_logs')
      .select(`
        *,
        actor:profiles!activity_logs_employee_id_fkey(id, full_name, employee_code)
      `)
      .eq('tactic_id', params.id)
      .order('created_at', { ascending: false }),

    (isAdmin || isManager)
      ? supabase
          .from('profiles')
          .select('id, full_name, employee_code')
          .eq('status', 'active')
          .order('full_name')
      : Promise.resolve({ data: [] as { id: string; full_name: string; employee_code: string }[] }),

    supabase
      .from('projects')
      .select('id, name, code')
      .eq('status', 'active')
      .order('name'),
  ])

  if (!tacticRes.data) notFound()

  const [tactic] = await enrichTacticRows([tacticRes.data as unknown as TacticRow])
  const logs     = await enrichActivityLogActors(
    (logsRes.data ?? []) as unknown as ActivityLogRow[],
  )
  const documents = await getDocuments({ tactic_code: tactic.code })
  const org = await getOrganization(profile.organization_id)
  const features = mergeWorkspaceSettings(org?.settings).features
  const [checklistItems, checklistTemplates, jobCost] = await Promise.all([
    features.checklists ? listTacticChecklist(tactic.id) : Promise.resolve([]),
    features.checklists ? listChecklistTemplates() : Promise.resolve([]),
    features.jobCosting ? getTacticJobCost(tactic.id) : Promise.resolve(null),
  ])
  const employees = (employeesRes.data ?? []) as { id: string; full_name: string; employee_code: string }[]
  const projects  = (projectsRes.data  ?? []) as { id: string; name: string; code: string }[]

  const isEmployee = !isAdmin && !isManager
  const employeeOptions = isEmployee
    ? [{ id: profile.id, full_name: profile.full_name, employee_code: profile.employee_code }]
    : employees

  // admin can edit all; manager can edit if they created it; employee cannot edit
  const canEdit = isAdmin || (isManager && tactic.created_by === profile.id)
  const canDelete = isAdmin || tactic.created_by === profile.id

  return (
    <TacticDetail
      tactic={tactic}
      logs={logs}
      documents={documents}
      employees={employeeOptions}
      projects={projects}
      role={profile.role}
      canEdit={canEdit}
      canDelete={canDelete}
      currentUserId={profile.id}
      checklistItems={checklistItems}
      checklistTemplates={checklistTemplates.filter((t) => t.is_active)}
      jobCost={jobCost}
    />
  )
}
