import Link from 'next/link'
import { Table2, ArrowRight, FileSpreadsheet } from 'lucide-react'
import { getMyWorkSheetCount } from '@/lib/actions/my-work'

export async function MyWorkDashboardCard() {
  const count = await getMyWorkSheetCount()

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
            <Table2 className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">My Work</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Personal spreadsheets & Notion-style pages
            </p>
          </div>
        </div>
        <Link
          href="/my-work"
          className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary-600 hover:underline"
        >
          Open
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2">
        <FileSpreadsheet className="h-4 w-4 text-neutral-400" />
        <span className="text-sm text-neutral-700">
          {count === 0
            ? 'No sheets yet — upload Excel or start blank'
            : `${count} spreadsheet${count === 1 ? '' : 's'}`}
        </span>
      </div>
    </div>
  )
}
