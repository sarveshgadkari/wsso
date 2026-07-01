import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { TacticsList } from '@/components/tactics/TacticsList'
import type { TacticRow } from '@/components/tactics/TacticDialog'

export const metadata = { title: 'Work Orders — WSSO' }

export default async function TacticsPage() {
  const profile  = await requireProfile()
  const supabase = await createClient()
  const isAdmin   = profile.role === 'admin'
  const isManager = profile.role === 'manager'

  // RLS auto-scopes: admin→all, manager→created_by=me OR team's tactics, employee→assigned_to=me
  const [tacticsRes, employeesRes, projectsRes] = await Promise.all([
    supabase
      .from('tactics')
      .select(`
        *,
        project:projects!tactics_project_id_fkey(id, name, code),
        assignee:profiles!tactics_assigned_to_fkey(id, full_name, employee_code),
        creator:profiles!tactics_created_by_fkey(id, full_name, employee_code)
      `)
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

  const tactics   = (tacticsRes.data   ?? []) as unknown as TacticRow[]
  const employees = (employeesRes.data ?? []) as { id: string; full_name: string; employee_code: string }[]
  const projects  = (projectsRes.data  ?? []) as { id: string; name: string; code: string }[]

  const isEmployee = !isAdmin && !isManager
  const employeeOptions = isEmployee
    ? [{ id: profile.id, full_name: profile.full_name, employee_code: profile.employee_code }]
    : employees

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Work Orders</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {isAdmin
            ? 'All work orders across the organisation. Codes are auto-generated (TAC001…).'
            : isManager
              ? 'Work orders you created or assigned to your team.'
              : 'Tasks assigned to you. Overdue tasks are highlighted in red.'}
        </p>
      </div>

      <TacticsList
        initialTactics={tactics}
        employees={employeeOptions}
        projects={projects}
        isAdmin={isAdmin}
        isManager={isManager}
        currentUserId={profile.id}
      />
    </div>
  )
}
