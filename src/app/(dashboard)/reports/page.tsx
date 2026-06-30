import { requireRole } from '@/lib/auth/session'
import { ReportsShell } from '@/components/reports/ReportsShell'

export const metadata = { title: 'Reports — WSSO' }

export default async function ReportsPage() {
  const profile = await requireRole(['admin', 'manager'])

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h2 className="text-xl font-semibold text-neutral-900">Reports</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {profile.role === 'manager'
            ? 'Data scoped to your team. Use the left panel to switch reports and set filters.'
            : 'Organisation-wide reports. Use the left panel to switch reports and set filters.'}
        </p>
      </div>

      <ReportsShell role={profile.role} />
    </div>
  )
}
