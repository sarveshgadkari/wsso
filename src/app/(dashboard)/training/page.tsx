import { requireProfile } from '@/lib/auth/session'
import { TrainingShell } from '@/components/training/TrainingShell'
import {
  listTrainingModules,
  getAdminTrainingProgress,
} from '@/lib/actions/training'

export const metadata = { title: 'Training — WSSO' }

export default async function TrainingPage() {
  const profile = await requireProfile()
  const isAdmin = profile.role === 'admin'

  const modules = await listTrainingModules()
  const progressRows = isAdmin ? await getAdminTrainingProgress() : []

  return (
    <TrainingShell
      modules={modules}
      isAdmin={isAdmin}
      progressRows={progressRows}
    />
  )
}
