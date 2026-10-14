// POST /api/omniforce/events — access changes pushed by Omni Force Vector.
// Signed: X-OmniForce-Timestamp + X-OmniForce-Signature = hex(HMAC-SHA256(secret, `${ts}.${body}`)).
// Each event_id is applied once. Omni Force Vector sends the current state, so repeats are harmless.
//
//   access.updated  { sub | omniforce_org_id [+ external_org_id], access: { plan_ref, seats } }   workspace active, plan/seats synced
//   access.revoked  { sub | omniforce_org_id [+ external_org_id] }                               workspace suspended
//   member.disabled { sub, scope }                                                               that person can't sign in
//   member.enabled  { sub, scope }                                                               block lifted
//
// `sub` alone means the person's personal workspace. A member event's scope says which
// workspace it is about ('account' = everywhere); it's ignored if the person's WSSO account
// lives in a different workspace. Only workspaces billed by Omni Force Vector are changed;
// WSSO's own customers are never touched.
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { planEnumFromSlug } from '@/lib/saas/plans'
import { omniforceConfig, omniforceEventsEnabled } from '@/lib/omniforce/config'
import { signatureOk } from '@/lib/omniforce/signature'

export const dynamic = 'force-dynamic'

const schema = z.object({
  event_id: z.string().min(1).max(200),
  event: z.enum(['access.updated', 'access.revoked', 'member.disabled', 'member.enabled']),
  sub: z.string().min(1).max(40).optional(),
  scope: z.enum(['account', 'personal', 'organization']).optional(),
  omniforce_org_id: z.string().uuid().optional(),
  external_org_id: z.string().uuid().optional(),
  access: z.object({ plan_ref: z.string().max(60).nullable().optional(), seats: z.number().int().positive().nullable().optional() }).optional(),
})
type OmniforceEvent = z.infer<typeof schema>

/** The workspace an event is about: the organization's, or the person's personal one. */
async function workspaceFor(e: OmniforceEvent, personal: boolean) {
  const q = () => supabaseAdmin.from('organizations').select('id, billing_source')
  if (!personal) {
    if (e.external_org_id) {
      const { data } = await q().eq('id', e.external_org_id).maybeSingle()
      if (data) return data
    }
    if (!e.omniforce_org_id) return null
    const { data } = await q().eq('omniforce_organization_id', e.omniforce_org_id).maybeSingle()
    return data
  }
  const { data } = await q().eq('omniforce_owner_user_id', e.sub ?? '').is('omniforce_organization_id', null).maybeSingle()
  return data
}

async function apply(e: OmniforceEvent): Promise<{ skipped?: string }> {
  if (e.event === 'member.disabled' || e.event === 'member.enabled') {
    const { data: profile } = await supabaseAdmin.from('profiles').select('id, organization_id').eq('omniforce_user_id', e.sub ?? '').maybeSingle()
    if (!profile) return { skipped: 'not_linked' }
    if (e.scope !== 'account') {
      const ws = await workspaceFor(e, e.scope === 'personal')
      if (!ws || ws.id !== profile.organization_id) return { skipped: 'other_workspace' }
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.id, { ban_duration: e.event === 'member.disabled' ? '876000h' : 'none' })
    if (error) throw new Error(error.message)
    return {}
  }

  const ws = await workspaceFor(e, !e.omniforce_org_id && !e.external_org_id)
  if (!ws || ws.billing_source !== 'omniforce') return { skipped: 'no_workspace' }

  const ref = e.access?.plan_ref ?? ''
  const patch = e.event === 'access.revoked'
    ? { status: 'suspended' as const }
    : {
        status: 'active' as const,
        trial_ends_at: null,
        current_period_end: null,
        ...(e.access?.seats ? { seat_limit: e.access.seats } : {}),
        ...(['trial', 'starter', 'growth', 'business', 'enterprise'].includes(ref) ? { plan: planEnumFromSlug(ref) } : {}),
      }
  const { error } = await supabaseAdmin.from('organizations').update(patch).eq('id', ws.id)
  if (error) throw new Error(error.message)
  return {}
}

export async function POST(request: NextRequest) {
  if (!omniforceEventsEnabled()) return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  const raw = await request.text()
  if (raw.length > 16_384) return NextResponse.json({ error: 'too_large' }, { status: 413 })
  if (!signatureOk(raw, request.headers.get('x-omniforce-timestamp') ?? '', request.headers.get('x-omniforce-signature') ?? '', omniforceConfig().eventsSecret)) {
    return NextResponse.json({ error: 'bad_signature' }, { status: 401 })
  }

  let parsed
  try {
    parsed = schema.safeParse(JSON.parse(raw))
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }
  if (!parsed.success) return NextResponse.json({ error: 'invalid_event' }, { status: 400 })
  const e = parsed.data
  const isMember = e.event === 'member.disabled' || e.event === 'member.enabled'
  if (isMember ? !e.sub || !e.scope || (e.scope === 'organization' && !e.omniforce_org_id) : !e.sub && !e.omniforce_org_id && !e.external_org_id) {
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 })
  }

  const { error: dup } = await supabaseAdmin.from('omniforce_events').insert({ event_id: e.event_id, event: e.event, payload: e })
  if (dup) {
    if ((dup as { code?: string }).code === '23505') return NextResponse.json({ ok: true, duplicate: true })
    console.error('[omniforce/events] store', dup.message)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  try {
    return NextResponse.json({ ok: true, ...(await apply(e)) })
  } catch (err) {
    // not applied: forget the id so Omni Force Vector's retry is processed
    await supabaseAdmin.from('omniforce_events').delete().eq('event_id', e.event_id)
    console.error('[omniforce/events] apply', (err as Error).message)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
