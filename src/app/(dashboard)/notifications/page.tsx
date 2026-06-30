import { requireProfile } from '@/lib/auth/session'
import { getNotifications } from '@/lib/actions/notifications'
import { NotificationsList } from '@/components/notifications/NotificationsList'

export const metadata = { title: 'Notifications — WSSO' }

export default async function NotificationsPage() {
  await requireProfile()
  const notifications = await getNotifications(50)

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Notifications</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Task assignments, status updates, and review requests.
        </p>
      </div>

      <NotificationsList notifications={notifications} />
    </div>
  )
}
