import { requireSuperAdmin } from '@/lib/auth/session'
import { PlatformSidebar } from '@/components/platform/PlatformSidebar'
import { Topbar } from '@/components/layout/Topbar'
import { ToastContainer } from '@/components/ui/Toast'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireSuperAdmin()

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <PlatformSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar profile={profile} notifCount={0} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <ToastContainer />
    </div>
  )
}
