import { redirect } from 'next/navigation'
import { requireProfile, getOrganization } from '@/lib/auth/session'
import { mergeWorkspaceSettings } from '@/lib/workspace/settings'
import { currentMonthRange } from '@/lib/daily-work/catalog'
import { listMyDailyWork, listReviewDailyWork } from '@/lib/actions/daily-work'
import { DailyWorkShell } from '@/components/daily-work/DailyWorkShell'

export const metadata = { title: 'Daily Work — WSSO' }

interface Props {
  searchParams: { from?: string; to?: string }
}

export default async function DailyWorkPage({ searchParams }: Props) {
  const profile = await requireProfile()
  const org = await getOrganization(profile.organization_id)
  if (!mergeWorkspaceSettings(org?.settings).features.dailyWork) redirect('/dashboard')

  const month = currentMonthRange()
  const from = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.from ?? '') ? searchParams.from! : month.from
  const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.to ?? '') ? searchParams.to! : month.to
  const mine = await listMyDailyWork(from, to)
  const review = profile.role === 'admin' || profile.role === 'manager'
    ? await listReviewDailyWork(from, to)
    : { rows: [], error: undefined }
  const missingTable = mine.error === 'missing_table' || review.error === 'missing_table'

  return (
    <DailyWorkShell
      viewerRole={profile.role}
      from={from}
      to={to}
      mine={missingTable ? [] : mine.rows}
      review={missingTable ? [] : review.rows}
      missingTable={missingTable}
    />
  )
}
