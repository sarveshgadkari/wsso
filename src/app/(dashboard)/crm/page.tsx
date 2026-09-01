import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { LeadsTable, type LeadRow } from '@/components/crm/LeadsTable'
import { CrmLeadActions } from '@/components/crm/CrmLeadActions'
import { listCatalog, getWorkspaceSettings } from '@/lib/actions/workspace'

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

  const [companiesRes, winReasons, lostReasons, settings] = await Promise.all([
    supabase.from('companies').select('id, name').order('name'),
    listCatalog('win_reason', true),
    listCatalog('lost_reason', true),
    getWorkspaceSettings(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">CRM</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Add leads here or in bulk from CSV. Assign people to work them. Website enquiry forms still appear in this list.
          </p>
        </div>
        <CrmLeadActions />
      </div>

      <LeadsTable
        initialLeads={(leads ?? []) as unknown as LeadRow[]}
        companies={companiesRes.data ?? []}
        winReasons={winReasons}
        lostReasons={lostReasons}
        defaultFollowUpDays={settings.crm.defaultFollowUpDays}
      />
    </div>
  )
}
