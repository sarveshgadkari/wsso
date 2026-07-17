import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { MyLeadsTable, type MyLeadRow } from '@/components/crm/MyLeadsTable'

export const metadata = { title: 'My Leads — WSSO' }

export default async function MyLeadsPage() {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const { data: assignments } = await supabase
    .from('lead_assignments')
    .select('id, created_at, lead:leads(*)')
    .eq('employee_id', profile.id)
    .order('created_at', { ascending: false })

  const leads = ((assignments ?? []) as unknown as MyLeadRow[])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">My Leads</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Leads assigned to you. Update the status as you work them.
        </p>
      </div>

      <MyLeadsTable initialAssignments={leads} />
    </div>
  )
}
