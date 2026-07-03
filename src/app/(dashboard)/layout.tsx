import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { ToastContainer } from '@/components/ui/Toast'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Redirect to /login if no valid session
  const profile = await requireProfile()

  // Fetch unread notification count
  const supabase = await createClient()
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('is_read', false)

  const notifCount = count ?? 0

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      {/* Fixed-width sidebar */}
      <Sidebar role={profile.role} notifCount={notifCount} />

      {/* Right: topbar + scrollable content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar profile={profile} notifCount={notifCount} />

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Global toast stack — rendered once, reads from Zustand store */}
      <ToastContainer />
    </div>
  )
}
