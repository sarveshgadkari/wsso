export type QuizOption = { id: string; text: string; is_correct: boolean }
export type QuizOptionPublic = { id: string; text: string }
export type TrainingLink = { title: string; url: string }

export type QuestionInput = {
  question_text: string
  options: QuizOption[]
}

export function normalizeTrainingLinks(raw: unknown): TrainingLink[] {
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw) } catch { return [] }
  }
  if (!Array.isArray(parsed)) return []
  return parsed
    .map(item => {
      const o = (item ?? {}) as Record<string, unknown>
      const url = String(o.url ?? '').trim()
      const title = String(o.title ?? '').trim() || url
      return { title, url }
    })
    .filter(l => /^https?:\/\//i.test(l.url))
}

export function normalizeLinkUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

/** Normalize jsonb options from DB (handles stringified JSON, missing ids, loose booleans). */
export function normalizeQuizOptions(raw: unknown): QuizOption[] {
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(parsed)) return []

  return parsed.map((item, j) => {
    const o = (item ?? {}) as Record<string, unknown>
    const isCorrect =
      o.is_correct === true ||
      o.is_correct === 'true' ||
      o.is_correct === 1 ||
      o.is_correct === '1'

    return {
      id: String(o.id ?? `opt-${j}`),
      text: String(o.text ?? '').trim(),
      is_correct: Boolean(isCorrect),
    }
  })
}
