import { requireProfile, isSuperAdmin, getOrganization } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { ToastContainer } from '@/components/ui/Toast'
import { redirect } from 'next/navigation'
import { orgNeedsPayment } from '@/lib/saas/plans'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile()
  if (isSuperAdmin(profile)) redirect('/platform')

  const org = await getOrganization(profile.organization_id)
  const subscriptionLocked = org ? orgNeedsPayment(org) : false

  const supabase = await createClient()
  const { count } = subscriptionLocked
    ? { count: 0 }
    : await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false)

  const notifCount = count ?? 0

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <Sidebar role={profile.role} notifCount={notifCount} subscriptionLocked={subscriptionLocked} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar profile={profile} notifCount={notifCount} hideNotifications={subscriptionLocked} />

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      <ToastContainer />
    </div>
  )
}
