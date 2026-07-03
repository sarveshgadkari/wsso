import Link from 'next/link'
import { Megaphone, ArrowRight, Mail } from 'lucide-react'
import { getSentAnnouncements } from '@/lib/actions/announcements'
import { requireProfile } from '@/lib/auth/session'

export async function AnnouncementsDashboardCard() {
  const profile = await requireProfile()
  if (!['admin', 'manager'].includes(profile.role)) return null

  const sent = await getSentAnnouncements()
  const recent = sent.filter(a => a.status === 'published').slice(0, 1)

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50">
            <Megaphone className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Announcements</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Email & notify your {profile.role === 'admin' ? 'team' : 'team members'}
            </p>
          </div>
        </div>
        <Link
          href="/announcements?tab=compose"
          className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary-600 hover:underline"
        >
          Send
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2">
        <Mail className="h-4 w-4 text-neutral-400" />
        <span className="text-sm text-neutral-700">
          {recent.length === 0
            ? 'No announcements sent yet — draft and email your team'
            : `Last sent: ${recent[0].title}`}
        </span>
      </div>

      <Link
        href="/announcements"
        className="mt-3 inline-block text-xs text-primary-600 hover:underline"
      >
        View all announcements →
      </Link>
    </div>
  )
}
