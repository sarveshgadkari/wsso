import Link from 'next/link'
import { Plus } from 'lucide-react'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/Button'
import {
  TacticDocumentList,
  type TacticDocRow,
} from '@/components/tactic-documents/TacticDocumentList'
import { fetchTacticDocumentsForProfile } from '@/lib/tactic-documents/queries'

export const metadata = { title: 'TACTIC Documents — WSSO' }

export default async function TacticDocumentsPage() {
  const profile  = await requireProfile()
  const supabase = await createClient()
  const canFilter = ['admin', 'manager', 'director'].includes(profile.role)

  const docs = await fetchTacticDocumentsForProfile(profile) as TacticDocRow[]

  // Employees list for "Created by" filter (admin/manager/director only)
  let employees: { id: string; full_name: string; employee_code: string }[] = []
  if (canFilter) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, employee_code')
      .eq('status', 'active')
      .order('full_name')
    employees = data ?? []
  }

  const canCreate = ['admin', 'manager', 'employee'].includes(profile.role)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">TACTIC Documents</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Structured meeting-output documents capturing tasks, decisions, and next steps.
          </p>
        </div>
        {canCreate && (
          <Link href="/tactic-documents/new">
            <Button size="sm">
              <Plus className="h-3.5 w-3.5" />
              New TACTIC
            </Button>
          </Link>
        )}
      </div>

      <TacticDocumentList
        docs={docs}
        canFilter={canFilter}
        employees={employees}
      />
    </div>
  )
}
