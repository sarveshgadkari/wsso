import { requireProfile } from '@/lib/auth/session'
import { listMyWorkSheets, listWorkSheetFolders, getMyWorkOrderOptions } from '@/lib/actions/my-work'
import { MyWorkShell } from '@/components/my-work/MyWorkShell'

export const metadata = { title: 'My Work — WSSO' }

export default async function MyWorkPage() {
  await requireProfile()

  const [sheets, folders, workOrders] = await Promise.all([
    listMyWorkSheets(),
    listWorkSheetFolders(),
    getMyWorkOrderOptions(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">My Work</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Upload Excel for existing work (table), or create Notion-style pages for notes and new tasks.
          Link rows to work orders when needed.
        </p>
      </div>

      <MyWorkShell initialSheets={sheets} initialFolders={folders} workOrders={workOrders} />
    </div>
  )
}
