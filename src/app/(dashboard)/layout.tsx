import { requireProfile, isSuperAdmin, getOrganization } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { ToastContainer } from '@/components/ui/Toast'
import { StickyNotesLayer } from '@/components/sticky-notes/StickyNotesLayer'
import { redirect } from 'next/navigation'
import { orgNeedsPayment } from '@/lib/saas/plans'
import { mergeWorkspaceSettings } from '@/lib/workspace/settings'
import { recoverPaidCheckout } from '@/lib/saas/stripe-sync'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile()
  if (isSuperAdmin(profile)) redirect('/platform')

  let org = await getOrganization(profile.organization_id)
  if (org && profile.role === 'admin' && orgNeedsPayment(org)) {
    await recoverPaidCheckout(org.id)
    org = await getOrganization(profile.organization_id)
  }
  const subscriptionLocked = org ? orgNeedsPayment(org) : false
  const features = mergeWorkspaceSettings(org?.settings).features

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
      <Sidebar role={profile.role} notifCount={notifCount} subscriptionLocked={subscriptionLocked} features={features} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar profile={profile} notifCount={notifCount} hideNotifications={subscriptionLocked} />

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <main className="h-full overflow-y-auto p-6">
            {children}
          </main>
          {!subscriptionLocked && <StickyNotesLayer />}
        </div>
      </div>

      <ToastContainer />
    </div>
  )
}
