import { NextResponse } from 'next/server'
import { startBillingPortal } from '@/lib/actions/billing'

export async function POST() {
  const result = await startBillingPortal()
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ url: result.url })
}
