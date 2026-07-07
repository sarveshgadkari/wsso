import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth/session'
import {
  TacticDocumentDetail,
  type TacticDocFull,
} from '@/components/tactic-documents/TacticDocumentDetail'
import { canManagerReviewEmployeeTacticDoc } from '@/lib/tactic-documents/access'
import {
  canViewTacticDocument,
  fetchTacticDocumentById,
  fetchTacticDocumentNextSteps,
  fetchTacticDocumentTasks,
} from '@/lib/tactic-documents/queries'

interface Props {
  params: { id: string }
}

export async function generateMetadata() {
  return { title: 'TACTIC Document — WSSO' }
}

export default async function TacticDocumentPage({ params }: Props) {
  const profile = await requireProfile()

  const raw = await fetchTacticDocumentById(params.id)
  if (!raw) notFound()

  const allowed = await canViewTacticDocument(profile, params.id, raw.created_by as string)
  if (!allowed) notFound()

  const [tasks, next_steps] = await Promise.all([
    fetchTacticDocumentTasks(params.id),
    fetchTacticDocumentNextSteps(params.id),
  ])

  const creatorEmbed = raw.creator as unknown
  const creatorRaw = Array.isArray(creatorEmbed)
    ? (creatorEmbed[0] as TacticDocFull['creator'] | undefined)
    : (creatorEmbed as TacticDocFull['creator'] | null)
  const creator = creatorRaw ?? {
    id:            raw.created_by as string,
    full_name:     'Unknown',
    role:          'employee',
    employee_code: '',
    manager_id:    null,
  }

  const doc: TacticDocFull = {
    ...(raw as unknown as TacticDocFull),
    creator,
    tasks:      tasks as unknown as TacticDocFull['tasks'],
    next_steps: next_steps as unknown as TacticDocFull['next_steps'],
  }

  let canReview = false
  if (doc.status === 'submitted') {
    if (profile.role === 'admin' && creator.role === 'manager') {
      canReview = true
    } else if (profile.role === 'manager') {
      canReview = canManagerReviewEmployeeTacticDoc(profile.id, {
        role:       creator.role,
        manager_id: creator.manager_id ?? null,
      })
    }
  }

  return (
    <TacticDocumentDetail
      doc={doc}
      currentUserId={profile.id}
      role={profile.role}
      canReview={canReview}
    />
  )
}
