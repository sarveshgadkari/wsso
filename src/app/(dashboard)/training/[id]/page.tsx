import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth/session'
import { getTrainingModule } from '@/lib/actions/training'
import { TrainingModuleDetail } from '@/components/training/TrainingModuleDetail'

export const metadata = { title: 'Training module — WSSO' }

interface Props {
  params: { id: string }
}

export default async function TrainingModulePage({ params }: Props) {
  await requireProfile()
  const data = await getTrainingModule(params.id)
  if (!data) notFound()

  return (
    <TrainingModuleDetail
      module={data.module}
      progress={data.progress}
      questions={data.questionsPublic}
    />
  )
}
