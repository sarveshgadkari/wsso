import { requireProfile } from '@/lib/auth/session'
import {
  getReceivedAnnouncements,
  getSentAnnouncements,
  getAnnouncementDrafts,
  getAnnouncementRecipients,
} from '@/lib/actions/announcements'
import { AnnouncementsShell } from '@/components/announcements/AnnouncementsShell'

export const metadata = { title: 'Announcements — WSSO' }

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function AnnouncementsPage({ searchParams }: Props) {
  const profile = await requireProfile()
  const canSend = ['admin', 'manager'].includes(profile.role)
  const params = await searchParams

  const initialTab =
    params.tab === 'compose' && canSend ? 'compose' as const
    : params.tab === 'sent' && canSend ? 'sent' as const
    : 'feed' as const

  const [feed, sent, drafts, recipients] = await Promise.all([
    getReceivedAnnouncements(),
    canSend ? getSentAnnouncements() : Promise.resolve([]),
    canSend ? getAnnouncementDrafts() : Promise.resolve([]),
    canSend ? getAnnouncementRecipients() : Promise.resolve([]),
  ])

  return (
    <AnnouncementsShell
      viewer={profile}
      canSend={canSend}
      feed={feed}
      sent={sent}
      drafts={drafts}
      recipients={recipients}
      initialTab={initialTab}
    />
  )
}
