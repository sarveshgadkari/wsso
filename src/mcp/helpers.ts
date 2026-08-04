import { z } from 'zod'

export function ok(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
  }
}

export function fail(message: string) {
  return {
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    isError: true as const,
  }
}

export async function runTool<T>(fn: () => Promise<T>) {
  try {
    const data = await fn()
    return ok(data)
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Unknown error')
  }
}

export const UuidSchema = z.string().uuid()

export const PaginationSchema = {
  limit: z.number().int().min(1).max(100).optional().default(25),
  offset: z.number().int().min(0).optional().default(0),
}

export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')

export const TacticStatusSchema = z.enum([
  'assigned',
  'in_progress',
  'review',
  'done',
  'archived',
])

export const TacticPrioritySchema = z.enum(['low', 'medium', 'high', 'critical'])

export const LeadStatusSchema = z.enum([
  'new',
  'contacted',
  'qualified',
  'converted',
  'lost',
])

export const LeaveDecisionSchema = z.enum(['approved', 'rejected'])
