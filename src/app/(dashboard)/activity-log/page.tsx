import { requireAuth } from '@/lib/auth/session'

export default async function ActivityLogPage() {
  await requireAuth()
  return (
    <p className="text-sm text-neutral-400">
      Activity Log — full audit trail coming in the next build step.
    </p>
  )
}
