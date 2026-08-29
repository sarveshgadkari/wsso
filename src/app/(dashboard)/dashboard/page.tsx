import { redirect } from 'next/navigation'
import { getOrganization, requireProfile } from '@/lib/auth/session'
import { resolveTimezone } from '@/lib/utils/timezones'
import { orgNeedsPayment } from '@/lib/saas/plans'
import { AdminDashboard }    from '@/components/dashboard/AdminDashboard'
import { ManagerDashboard }  from '@/components/dashboard/ManagerDashboard'
import { EmployeeDashboard } from '@/components/dashboard/EmployeeDashboard'
import { SubscriptionLocked } from '@/components/billing/SubscriptionLocked'
import { AdminSubscriptionCard } from '@/components/billing/AdminSubscriptionCard'

export const metadata = { title: 'Dashboard — WSSO' }

export default async function DashboardPage() {
  const profile = await requireProfile()
  if (profile.role === 'super_admin') redirect('/platform')
  const tz      = resolveTimezone(profile.timezone)
  const org     = await getOrganization(profile.organization_id)
  const locked  = org ? orgNeedsPayment(org) : false
  const isAdmin = profile.role === 'admin'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">
          Welcome back, {profile.full_name ?? 'there'}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month:   'long',
            day:     'numeric',
            timeZone: tz,
          })}
        </p>
      </div>

      {locked ? (
        <SubscriptionLocked isAdmin={isAdmin} />
      ) : (
        <>
          {isAdmin && <AdminSubscriptionCard />}
          {profile.role === 'admin' || profile.role === 'director' ? (
            <AdminDashboard />
          ) : profile.role === 'manager' ? (
            <ManagerDashboard />
          ) : (
            <EmployeeDashboard />
          )}
        </>
      )}
    </div>
  )
}
