import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMcpClient } from '../auth'
import { runTool, UuidSchema } from '../helpers'
import { normalizeQuizOptions } from '@/lib/training/quiz'

export function registerTrainingTools(server: McpServer) {
  server.registerTool(
    'training_list_modules',
    {
      title: 'List Training Modules',
      description: 'List training modules in sequence order (unpublished only for admin).',
      inputSchema: {},
    },
    async (_args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        let query = supabase
          .from('training_modules')
          .select('id, title, description, sequence_order, has_test, pass_percent, is_published, created_at')
          .order('sequence_order', { ascending: true })

        // RLS only allows unpublished for admin; match that explicitly.
        if (profile.role !== 'admin') {
          query = query.eq('is_published', true)
        }

        const { data, error } = await query
        if (error) throw new Error(error.message)
        return { modules: data ?? [] }
      }),
  )

  server.registerTool(
    'training_get_module',
    {
      title: 'Get Training Module',
      description:
        'Get a training module with quiz questions. Correct answers are never returned (same as the web app).',
      inputSchema: { id: UuidSchema },
    },
    async ({ id }, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        const { data: module, error } = await supabase
          .from('training_modules')
          .select('*')
          .eq('id', id)
          .single()
        if (error) throw new Error(error.message)
        if (!module.is_published && profile.role !== 'admin') {
          throw new Error('Module not found')
        }

        const { data: questions, error: qErr } = await supabase
          .from('training_questions')
          .select('id, question_text, options, order_no')
          .eq('module_id', id)
          .order('order_no', { ascending: true })
        if (qErr) throw new Error(qErr.message)

        const safeQuestions = (questions ?? []).map((q) => {
          const opts = normalizeQuizOptions(q.options)
          return {
            id: q.id,
            question_text: q.question_text,
            order_no: q.order_no,
            options: opts.map((o) => ({ id: o.id, text: o.text })),
          }
        })

        return { module, questions: safeQuestions }
      }),
  )

  server.registerTool(
    'training_get_progress',
    {
      title: 'Get Training Progress',
      description: "Get the connected employee's training progress.",
      inputSchema: {
        module_id: UuidSchema.optional(),
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)
        let query = supabase
          .from('training_progress')
          .select('*')
          .eq('employee_id', profile.id)
          .order('started_at', { ascending: false })
        if (args.module_id) query = query.eq('module_id', args.module_id)
        const { data, error } = await query
        if (error) throw new Error(error.message)
        return { progress: data ?? [] }
      }),
  )

  server.registerTool(
    'training_submit_quiz',
    {
      title: 'Submit Training Quiz',
      description: 'Submit quiz answers for a module and record score/pass result.',
      inputSchema: {
        module_id: UuidSchema,
        answers: z.array(
          z.object({
            question_id: UuidSchema,
            selected_option_id: z.string().min(1),
          }),
        ),
      },
    },
    async (args, extra) =>
      runTool(async () => {
        const { supabase, profile } = getMcpClient(extra)

        const { data: module, error: mErr } = await supabase
          .from('training_modules')
          .select('id, pass_percent, has_test, is_published')
          .eq('id', args.module_id)
          .single()
        if (mErr || !module || !module.is_published) throw new Error('Module not found')
        if (!module.has_test) throw new Error('This module has no quiz')

        const { data: questions, error: qErr } = await supabase
          .from('training_questions')
          .select('id, options')
          .eq('module_id', args.module_id)
        if (qErr) throw new Error(qErr.message)
        if (!questions?.length) throw new Error('Module has no questions')

        const answerMap = new Map(
          args.answers.map((a) => [a.question_id, a.selected_option_id]),
        )

        let correct = 0
        let configuredCorrect = 0
        for (const q of questions) {
          const opts = normalizeQuizOptions(q.options)
          const correctOpt = opts.find((o) => o.is_correct)
          if (!correctOpt) continue
          configuredCorrect += 1
          const selected = answerMap.get(q.id)
          if (selected && selected === correctOpt.id) correct += 1
        }

        if (configuredCorrect === 0) {
          throw new Error(
            'This knowledge test has no correct answers marked. Ask an admin to fix the quiz.',
          )
        }

        const score = Math.round((correct / questions.length) * 100)
        const passed = score >= (module.pass_percent ?? 70)
        const now = new Date().toISOString()

        const { data: existing } = await supabase
          .from('training_progress')
          .select('id')
          .eq('employee_id', profile.id)
          .eq('module_id', args.module_id)
          .maybeSingle()

        const payload = {
          employee_id: profile.id,
          module_id: args.module_id,
          status: (passed ? 'completed' : 'in_progress') as 'completed' | 'in_progress',
          test_score: score,
          test_passed: passed,
          completed_at: passed ? now : null,
        }

        const result = existing
          ? await supabase
              .from('training_progress')
              .update(payload)
              .eq('id', existing.id)
              .select()
              .single()
          : await supabase.from('training_progress').insert(payload).select().single()

        if (result.error) throw new Error(result.error.message)
        return {
          score,
          passed,
          pass_percent: module.pass_percent,
          correct_count: correct,
          total: questions.length,
          progress: result.data,
        }
      }),
  )
}
