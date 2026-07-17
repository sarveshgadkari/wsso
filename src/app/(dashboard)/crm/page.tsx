import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { LeadsTable, type LeadRow } from '@/components/crm/LeadsTable'

export const metadata = { title: 'CRM — WSSO' }

export default async function CrmPage() {
  await requireRole(['admin'])
  const supabase = await createClient()

  const { data: leads } = await supabase
    .from('leads')
    .select(`
      *,
      assignments:lead_assignments(
        id, created_at,
        employee:profiles!lead_assignments_employee_id_fkey(id, full_name, employee_code, role)
      )
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">CRM</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Enquiry leads from all websites. Assign a lead to one or more people to have them work it.
        </p>
      </div>

      <LeadsTable initialLeads={(leads ?? []) as unknown as LeadRow[]} />
    </div>
  )
}
