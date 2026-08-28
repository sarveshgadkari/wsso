import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/saas/stripe'
import {
  applyStripeSubscriptionEvent,
  fulfillCheckoutSession,
  markOrgPastDueFromInvoice,
  syncOrgFromPaidInvoice,
} from '@/lib/saas/stripe-sync'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const stripe = getStripe()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !secret) {
    return NextResponse.json({ error: 'Stripe webhook not configured' }, { status: 501 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const payload = await request.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.id) await fulfillCheckoutSession(session.id)
      break
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await applyStripeSubscriptionEvent(event.data.object as Stripe.Subscription)
      break
    }
    case 'invoice.paid': {
      await syncOrgFromPaidInvoice(event.data.object as Stripe.Invoice)
      break
    }
    case 'invoice.payment_failed': {
      await markOrgPastDueFromInvoice(event.data.object as Stripe.Invoice)
      break
    }
    default:
      break
  }

  return NextResponse.json({ received: true })
}
