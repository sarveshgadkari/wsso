'use server'

import { revalidatePath } from 'next/cache'
import { requireProfile, requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { TrainingModule, TrainingProgress, TrainingQuestion } from '@/lib/types'
import type { Database } from '@/lib/types/database'
import { normalizeQuizOptions, normalizeTrainingLinks, normalizeLinkUrl } from '@/lib/training/quiz'
import type { QuestionInput, QuizOption, QuizOptionPublic, TrainingLink } from '@/lib/training/quiz'

const BUCKET = 'training'
const MAX_FILE_BYTES = 50 * 1024 * 1024
const ALLOWED_EXT = new Set([
  'pdf', 'ppt', 'pptx', 'doc', 'docx',
  'xls', 'xlsx', 'txt', 'png', 'jpg', 'jpeg',
])

export type { QuestionInput, QuizOption, QuizOptionPublic, TrainingLink }

export type ModuleWithProgress = TrainingModule & {
  progress: TrainingProgress | null
  question_count: number
}

export type AdminProgressRow = {
  employee_id: string
  full_name: string
  employee_code: string
  role: string
  completed_count: number
  total_modules: number
  modules: {
    module_id: string
    title: string
    status: 'not_started' | 'in_progress' | 'completed'
    test_score: number | null
    completed_at: string | null
  }[]
}

async function ensureBucket() {
  await supabaseAdmin.storage
    .createBucket(BUCKET, { public: false, fileSizeLimit: '50mb' })
    .catch(() => {/* exists */})
}

function revalidateTraining() {
  revalidatePath('/training')
  revalidatePath('/dashboard')
}

function extOf(name: string) {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listTrainingModules(): Promise<ModuleWithProgress[]> {
  const profile = await requireProfile()
  const supabase = await createClient()
  const isAdmin = profile.role === 'admin'

  let query = supabase
    .from('training_modules')
    .select('*')
    .order('sequence_order', { ascending: true })

  if (!isAdmin) query = query.eq('is_published', true)

  const { data: modules, error } = await query
  if (error) throw new Error(error.message)

  const ids = (modules ?? []).map(m => m.id)
  if (!ids.length) return []

  const [{ data: progress }, { data: questions }] = await Promise.all([
    supabase
      .from('training_progress')
      .select('*')
      .eq('employee_id', profile.id)
      .in('module_id', ids),
    supabase
      .from('training_questions')
      .select('id, module_id')
      .in('module_id', ids),
  ])

  const progressByModule = new Map((progress ?? []).map(p => [p.module_id, p as TrainingProgress]))
  const countByModule = new Map<string, number>()
  ;(questions ?? []).forEach(q => {
    countByModule.set(q.module_id, (countByModule.get(q.module_id) ?? 0) + 1)
  })

  return (modules as TrainingModule[]).map(m => ({
    ...m,
    progress: progressByModule.get(m.id) ?? null,
    question_count: countByModule.get(m.id) ?? 0,
  }))
}

export async function getTrainingModule(id: string): Promise<{
  module: TrainingModule
  progress: TrainingProgress | null
  questionsPublic: { id: string; question_text: string; options: QuizOptionPublic[]; order_no: number }[]
} | null> {
  const profile = await requireProfile()
  const supabase = await createClient()

  const { data: mod } = await supabase
    .from('training_modules')
    .select('*')
    .eq('id', id)
    .single()

  if (!mod) return null
  if (!mod.is_published && profile.role !== 'admin') return null

  const [{ data: progress }, { data: questions }] = await Promise.all([
    supabase
      .from('training_progress')
      .select('*')
      .eq('module_id', id)
      .eq('employee_id', profile.id)
      .maybeSingle(),
    supabase
      .from('training_questions')
      .select('id, question_text, options, order_no')
      .eq('module_id', id)
      .order('order_no'),
  ])

  const questionsPublic = (questions ?? []).map(q => {
    const opts = normalizeQuizOptions(q.options)
    return {
      id: q.id as string,
      question_text: q.question_text as string,
      order_no: q.order_no as number,
      options: opts.map(o => ({ id: o.id, text: o.text })),
    }
  })

  return {
    module: mod as TrainingModule,
    progress: (progress as TrainingProgress | null) ?? null,
    questionsPublic,
  }
}

export async function getTrainingFileUrl(moduleId: string): Promise<string> {
  const profile = await requireProfile()
  const supabase = await createClient()

  const { data: mod } = await supabase
    .from('training_modules')
    .select('file_path, is_published')
    .eq('id', moduleId)
    .single()

  if (!mod?.file_path) throw new Error('No file attached')
  if (!mod.is_published && profile.role !== 'admin') throw new Error('Not available')

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(mod.file_path, 3600)

  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Could not open file')
  return data.signedUrl
}

export async function getMyTrainingSummary(): Promise<{
  total: number
  completed: number
}> {
  try {
    const modules = await listTrainingModules()
    const published = modules.filter(m => m.is_published)
    return {
      total: published.length,
      completed: published.filter(m => m.progress?.status === 'completed').length,
    }
  } catch {
    return { total: 0, completed: 0 }
  }
}

export async function getAdminTrainingProgress(): Promise<AdminProgressRow[]> {
  await requireRole(['admin'])

  const { data: modules } = await supabaseAdmin
    .from('training_modules')
    .select('id, title, sequence_order, is_published')
    .eq('is_published', true)
    .order('sequence_order')

  const published = modules ?? []
  const total = published.length

  const { data: employees } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, employee_code, role')
    .eq('status', 'active')
    .in('role', ['employee', 'manager', 'director'])
    .order('full_name')

  const { data: allProgress } = await supabaseAdmin
    .from('training_progress')
    .select('*')

  const progressMap = new Map<string, TrainingProgress>()
  ;(allProgress ?? []).forEach(p => {
    progressMap.set(`${p.employee_id}:${p.module_id}`, p as TrainingProgress)
  })

  return (employees ?? []).map(emp => {
    const modulesStatus = published.map(m => {
      const p = progressMap.get(`${emp.id}:${m.id}`)
      return {
        module_id: m.id,
        title: m.title,
        status: (p?.status ?? 'not_started') as 'not_started' | 'in_progress' | 'completed',
        test_score: p?.test_score ?? null,
        completed_at: p?.completed_at ?? null,
      }
    })
    return {
      employee_id: emp.id,
      full_name: emp.full_name,
      employee_code: emp.employee_code,
      role: emp.role,
      completed_count: modulesStatus.filter(m => m.status === 'completed').length,
      total_modules: total,
      modules: modulesStatus,
    }
  })
}

// ── Learner actions ───────────────────────────────────────────────────────────

export async function startTrainingModule(moduleId: string) {
  const profile = await requireProfile()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('training_progress')
    .select('id, status')
    .eq('module_id', moduleId)
    .eq('employee_id', profile.id)
    .maybeSingle()

  if (existing) return existing

  const { data, error } = await supabase
    .from('training_progress')
    .insert({
      module_id: moduleId,
      employee_id: profile.id,
      status: 'in_progress',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidateTraining()
  return data
}

export async function completeTrainingModule(moduleId: string) {
  const profile = await requireProfile()
  const supabase = await createClient()

  const { data: mod } = await supabase
    .from('training_modules')
    .select('id, has_test, is_published')
    .eq('id', moduleId)
    .single()

  if (!mod || !mod.is_published) throw new Error('Module not found')
  if (mod.has_test) throw new Error('This module requires a knowledge test')

  const now = new Date().toISOString()
  const { data: existing } = await supabase
    .from('training_progress')
    .select('id')
    .eq('module_id', moduleId)
    .eq('employee_id', profile.id)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('training_progress')
      .update({ status: 'completed', completed_at: now })
      .eq('id', existing.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase
      .from('training_progress')
      .insert({
        module_id: moduleId,
        employee_id: profile.id,
        status: 'completed',
        completed_at: now,
      })
    if (error) throw new Error(error.message)
  }

  revalidateTraining()
  revalidatePath(`/training/${moduleId}`)
}

export async function submitTrainingTest(
  moduleId: string,
  answers: { question_id: string; option_id: string }[],
): Promise<{ passed: boolean; score: number; pass_percent: number; correct_count: number; total: number }> {
  const profile = await requireProfile()

  const { data: mod } = await supabaseAdmin
    .from('training_modules')
    .select('id, has_test, pass_percent, is_published')
    .eq('id', moduleId)
    .single()

  if (!mod || !mod.is_published) throw new Error('Module not found')
  if (!mod.has_test) throw new Error('This module has no test')

  const { data: questions } = await supabaseAdmin
    .from('training_questions')
    .select('id, options')
    .eq('module_id', moduleId)

  const qs = questions ?? []
  if (!qs.length) throw new Error('No questions configured')

  const answerMap = new Map(
    (answers ?? [])
      .filter(a => a?.question_id && a?.option_id)
      .map(a => [String(a.question_id), String(a.option_id)]),
  )

  let correct = 0
  let configuredCorrect = 0
  for (const q of qs) {
    const chosen = answerMap.get(String(q.id))
    const opts = normalizeQuizOptions(q.options)
    const right = opts.find(o => o.is_correct)
    if (!right) continue
    configuredCorrect++
    if (chosen && chosen === right.id) {
      correct++
    }
  }

  if (configuredCorrect === 0) {
    throw new Error(
      'This knowledge test has no correct answers marked. Please ask an admin to open Manage Modules → quiz icon → select the correct option for each question → Save test.',
    )
  }

  const total = qs.length
  const score = total > 0 ? Math.round((correct / total) * 100) : 0
  const passed = score >= mod.pass_percent
  const now = new Date().toISOString()

  const { data: existing } = await supabaseAdmin
    .from('training_progress')
    .select('id')
    .eq('module_id', moduleId)
    .eq('employee_id', profile.id)
    .maybeSingle()

  const payload = {
    status: passed ? 'completed' as const : 'in_progress' as const,
    test_score: score,
    test_passed: passed,
    completed_at: passed ? now : null,
  }

  if (existing) {
    await supabaseAdmin
      .from('training_progress')
      .update(payload)
      .eq('id', existing.id)
  } else {
    await supabaseAdmin
      .from('training_progress')
      .insert({
        module_id: moduleId,
        employee_id: profile.id,
        ...payload,
      })
  }

  revalidateTraining()
  revalidatePath(`/training/${moduleId}`)
  return { passed, score, pass_percent: mod.pass_percent, correct_count: correct, total }
}

// ── Admin actions ─────────────────────────────────────────────────────────────

export async function createTrainingModule(formData: FormData) {
  const profile = await requireRole(['admin'])
  await ensureBucket()

  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const bodyContent = String(formData.get('body_content') ?? '').trim()
  const linksRaw = String(formData.get('links') ?? '[]')
  const hasTest = formData.get('has_test') === 'true' || formData.get('has_test') === 'on'
  const passPercent = Math.min(100, Math.max(1, Number(formData.get('pass_percent') ?? 80) || 80))
  const isPublished = formData.get('is_published') !== 'false'
  const file = formData.get('file') as File | null

  if (!title) throw new Error('Title is required')

  let links: TrainingLink[] = []
  try {
    links = normalizeTrainingLinks(JSON.parse(linksRaw))
  } catch {
    links = []
  }
  // Re-normalize URLs from form (may lack protocol)
  links = links
    .map(l => ({ title: l.title.trim() || l.url, url: normalizeLinkUrl(l.url) }))
    .filter(l => /^https?:\/\//i.test(l.url))

  const { data: maxRow } = await supabaseAdmin
    .from('training_modules')
    .select('sequence_order')
    .order('sequence_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sequence_order = (maxRow?.sequence_order ?? 0) + 1

  let file_path: string | null = null
  let file_name: string | null = null
  let file_type: string | null = null
  let file_size: number | null = null

  if (file && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) throw new Error('File must be under 50 MB')
    const ext = extOf(file.name)
    if (!ALLOWED_EXT.has(ext)) {
      throw new Error('Allowed files: PDF, PPT, PPTX, DOC, DOCX, XLS, XLSX, images')
    }
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    file_path = `${profile.id}/${Date.now()}-${safe}`
    file_name = file.name
    file_type = file.type || ext
    file_size = file.size

    const bytes = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(file_path, bytes, { contentType: file.type || 'application/octet-stream' })
    if (upErr) throw new Error(upErr.message)
  }

  if (!file_path && !bodyContent && !links.length && !description) {
    throw new Error('Add training text, a file, a link, or a short description')
  }

  const { data, error } = await supabaseAdmin
    .from('training_modules')
    .insert({
      title,
      description: description || null,
      body_content: bodyContent || null,
      links,
      sequence_order,
      file_path,
      file_name,
      file_type,
      file_size,
      has_test: hasTest,
      pass_percent: passPercent,
      is_published: isPublished,
      created_by: profile.id,
    })
    .select()
    .single()

  if (error) {
    if (file_path) await supabaseAdmin.storage.from(BUCKET).remove([file_path]).catch(() => {})
    throw new Error(error.message)
  }

  revalidateTraining()
  return data as TrainingModule
}

export async function updateTrainingModule(
  id: string,
  input: {
    title?: string
    description?: string | null
    body_content?: string | null
    links?: TrainingLink[]
    has_test?: boolean
    pass_percent?: number
    is_published?: boolean
  },
) {
  await requireRole(['admin'])

  const patch: Database['public']['Tables']['training_modules']['Update'] = {}
  if (input.title !== undefined) {
    const t = input.title.trim()
    if (!t) throw new Error('Title is required')
    patch.title = t
  }
  if (input.description !== undefined) patch.description = input.description?.trim() || null
  if (input.body_content !== undefined) patch.body_content = input.body_content?.trim() || null
  if (input.links !== undefined) {
    patch.links = input.links
      .map(l => ({
        title: (l.title || l.url).trim(),
        url: normalizeLinkUrl(l.url),
      }))
      .filter(l => /^https?:\/\//i.test(l.url))
  }
  if (input.has_test !== undefined) patch.has_test = input.has_test
  if (input.pass_percent !== undefined) {
    patch.pass_percent = Math.min(100, Math.max(1, input.pass_percent))
  }
  if (input.is_published !== undefined) patch.is_published = input.is_published

  const { error } = await supabaseAdmin
    .from('training_modules')
    .update(patch)
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidateTraining()
  revalidatePath(`/training/${id}`)
}

export async function replaceTrainingModuleFile(id: string, formData: FormData) {
  const profile = await requireRole(['admin'])
  await ensureBucket()

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) throw new Error('Choose a file')
  if (file.size > MAX_FILE_BYTES) throw new Error('File must be under 50 MB')

  const ext = extOf(file.name)
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error('Allowed files: PDF, PPT, PPTX, DOC, DOCX, XLS, XLSX, images')
  }

  const { data: existing } = await supabaseAdmin
    .from('training_modules')
    .select('file_path')
    .eq('id', id)
    .single()

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const file_path = `${profile.id}/${Date.now()}-${safe}`
  const bytes = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(file_path, bytes, { contentType: file.type || 'application/octet-stream' })
  if (upErr) throw new Error(upErr.message)

  const { error } = await supabaseAdmin
    .from('training_modules')
    .update({
      file_path,
      file_name: file.name,
      file_type: file.type || ext,
      file_size: file.size,
    })
    .eq('id', id)

  if (error) {
    await supabaseAdmin.storage.from(BUCKET).remove([file_path]).catch(() => {})
    throw new Error(error.message)
  }

  if (existing?.file_path) {
    await supabaseAdmin.storage.from(BUCKET).remove([existing.file_path]).catch(() => {})
  }

  revalidateTraining()
  revalidatePath(`/training/${id}`)
}

export async function deleteTrainingModule(id: string) {
  await requireRole(['admin'])

  const { data: mod } = await supabaseAdmin
    .from('training_modules')
    .select('file_path')
    .eq('id', id)
    .single()

  const { error } = await supabaseAdmin
    .from('training_modules')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  if (mod?.file_path) {
    await supabaseAdmin.storage.from(BUCKET).remove([mod.file_path]).catch(() => {})
  }

  revalidateTraining()
}

export async function reorderTrainingModules(orderedIds: string[]) {
  await requireRole(['admin'])

  await Promise.all(
    orderedIds.map((id, index) =>
      supabaseAdmin
        .from('training_modules')
        .update({ sequence_order: index + 1 })
        .eq('id', id),
    ),
  )

  revalidateTraining()
}

export async function saveTrainingQuestions(moduleId: string, questions: QuestionInput[]) {
  await requireRole(['admin'])

  for (const q of questions) {
    if (!q.question_text.trim()) throw new Error('Each question needs text')
    if (q.options.length < 2) throw new Error('Each question needs at least 2 options')
    if (!q.options.some(o => o.is_correct)) throw new Error('Mark one correct answer per question')
    if (q.options.filter(o => o.is_correct).length !== 1) {
      throw new Error('Exactly one correct answer required per question')
    }
  }

  const { error: delErr } = await supabaseAdmin
    .from('training_questions')
    .delete()
    .eq('module_id', moduleId)
  if (delErr) throw new Error(delErr.message)

  if (questions.length) {
    const rows = questions.map((q, i) => {
      const options = q.options.map((o, j) => ({
        id: (o.id && String(o.id).trim()) || `q${i}-opt${j}`,
        text: o.text.trim(),
        is_correct: Boolean(o.is_correct),
      }))
      // Guarantee exactly one correct after normalize
      if (!options.some(o => o.is_correct) && options[0]) {
        options[0].is_correct = true
      }
      return {
        module_id: moduleId,
        question_text: q.question_text.trim(),
        options,
        order_no: i + 1,
      }
    })
    const { error } = await supabaseAdmin.from('training_questions').insert(rows)
    if (error) throw new Error(error.message)
  }

  await supabaseAdmin
    .from('training_modules')
    .update({ has_test: questions.length > 0 })
    .eq('id', moduleId)

  revalidateTraining()
  revalidatePath(`/training/${moduleId}`)
}

export async function getTrainingQuestionsAdmin(moduleId: string): Promise<TrainingQuestion[]> {
  await requireRole(['admin'])
  const { data, error } = await supabaseAdmin
    .from('training_questions')
    .select('*')
    .eq('module_id', moduleId)
    .order('order_no')
  if (error) throw new Error(error.message)
  return (data ?? []) as TrainingQuestion[]
}
