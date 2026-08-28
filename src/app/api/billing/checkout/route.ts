import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { startCheckout } from '@/lib/actions/billing'

const schema = z.object({
  planId:   z.string().uuid(),
  interval: z.enum(['month', 'year']),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const result = await startCheckout(parsed.data.planId, parsed.data.interval)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ url: result.url })
}
