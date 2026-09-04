import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { listCatalog } from '@/lib/actions/workspace'
import { listComplianceRecords } from '@/lib/actions/ops'
import { applyManagerProfileFilter, managerScope } from '@/lib/saas/team-scope'
import { ComplianceTable } from '@/components/ops/ComplianceTable'
import { todayInTimezone, addCalendarDays } from '@/lib/utils/dates'
import { resolveTimezone } from '@/lib/utils/timezones'

export const metadata = { title: 'Licenses & expiry — WSSO' }

export default async function CompliancePage() {
  const profile = await requireProfile()
  if (!['admin', 'manager'].includes(profile.role)) redirect('/dashboard')

  const supabase = await createClient()
  const scope = await managerScope(profile)
  const tz = resolveTimezone(profile.timezone)
  const today = todayInTimezone(tz)
  const soon = addCalendarDays(today, 30)

  const [records, types, peopleRes, clientsRes] = await Promise.all([
    listComplianceRecords(),
    listCatalog('compliance_type', true),
    applyManagerProfileFilter(
      supabase.from('profiles').select('id, full_name, employee_code').eq('status', 'active').order('full_name'),
      scope,
    ),
    supabase.from('clients').select('id, name, code').eq('status', 'active').order('name'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Licenses & expiry</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Driver licenses, insurance, contracts, certifications. Warns 30 days before they lapse.
        </p>
      </div>
      <ComplianceTable
        records={records}
        types={types}
        people={peopleRes.data ?? []}
        clients={clientsRes.data ?? []}
        today={today}
        soon={soon}
      />
    </div>
  )
}
