import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import type { TacticRow } from '@/components/tactics/TacticDialog'

export const metadata = { title: 'Kanban — WSSO' }

export default async function KanbanPage() {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const { data } = await supabase
    .from('tactics')
    .select(`
      *,
      project:projects!tactics_project_id_fkey(id, name, code),
      assignee:profiles!tactics_assigned_to_fkey(id, full_name, employee_code),
      creator:profiles!tactics_created_by_fkey(id, full_name, employee_code)
    `)
    .order('created_at', { ascending: false })

  const tactics = (data ?? []) as unknown as TacticRow[]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Kanban board</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Drag cards between columns to update status. Transitions are validated server-side and sync live.
        </p>
      </div>

      <KanbanBoard
        initialTactics={tactics}
        role={profile.role}
        currentUserId={profile.id}
      />
    </div>
  )
}
