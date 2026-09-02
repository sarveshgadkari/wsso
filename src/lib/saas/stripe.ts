import Stripe from 'stripe'

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key)
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://wsso.tlbisbig.world').replace(/\/$/, '')
}

/** Stripe 2025+ moved period dates onto subscription items; older payloads still have them on the sub. */
export function stripePeriodEndUnix(sub: unknown): number | undefined {
  if (!sub || typeof sub !== 'object') return undefined
  const record = sub as {
    current_period_end?: number
    items?: { data?: Array<{ current_period_end?: number }> }
  }
  if (typeof record.current_period_end === 'number') return record.current_period_end
  const itemEnd = record.items?.data?.[0]?.current_period_end
  return typeof itemEnd === 'number' ? itemEnd : undefined
}

export function invoiceSubscriptionId(invoice: unknown): string | undefined {
  if (!invoice || typeof invoice !== 'object') return undefined
  const record = invoice as {
    subscription?: string | { id?: string } | null
    parent?: { subscription_details?: { subscription?: string | { id?: string } } }
  }
  if (typeof record.subscription === 'string') return record.subscription
  if (record.subscription && typeof record.subscription === 'object' && record.subscription.id) {
    return record.subscription.id
  }
  const nested = record.parent?.subscription_details?.subscription
  if (typeof nested === 'string') return nested
  if (nested && typeof nested === 'object') return nested.id
  return undefined
}

export function stripeCustomerId(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value && typeof (value as { id: unknown }).id === 'string') {
    return (value as { id: string }).id
  }
  return undefined
}
