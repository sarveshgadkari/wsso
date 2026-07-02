import { requireRole } from '@/lib/auth/session'
import { ReportsShell } from '@/components/reports/ReportsShell'
import { resolveTimezone } from '@/lib/utils/timezones'
import { timezoneShortLabel } from '@/components/reports/report-utils'

export const metadata = { title: 'Reports — WSSO' }

export default async function ReportsPage() {
  const profile        = await requireRole(['admin', 'manager'])
  const viewerTimezone = resolveTimezone(profile.timezone)
  const tzLabel        = timezoneShortLabel(viewerTimezone)

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h2 className="text-xl font-semibold text-neutral-900">Reports</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {profile.role === 'manager'
            ? 'Data scoped to your team. Use the left panel to switch reports and set filters.'
            : 'Organisation-wide reports. Use the left panel to switch reports and set filters.'}
          {' '}Date defaults use your timezone ({tzLabel}). Time rows still reflect each employee&apos;s local work day.
        </p>
      </div>

      <ReportsShell role={profile.role} viewerTimezone={viewerTimezone} />
    </div>
  )
}
