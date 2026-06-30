import { requireProfile } from '@/lib/auth/session'
import { AdminDashboard }    from '@/components/dashboard/AdminDashboard'
import { ManagerDashboard }  from '@/components/dashboard/ManagerDashboard'
import { EmployeeDashboard } from '@/components/dashboard/EmployeeDashboard'

export const metadata = { title: 'Dashboard — WSSO' }

export default async function DashboardPage() {
  const profile = await requireProfile()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">
          Welcome back, {profile.full_name}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {profile.role === 'admin' || profile.role === 'director' ? (
        <AdminDashboard />
      ) : profile.role === 'manager' ? (
        <ManagerDashboard />
      ) : (
        <EmployeeDashboard />
      )}
    </div>
  )
}
