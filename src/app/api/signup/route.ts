import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isSignupEnabled, PLAN_SEAT_LIMITS, slugify, TRIAL_DAYS } from '@/lib/saas/plans'

const schema = z.object({
  workspace_name: z.string().min(2, 'Workspace name is required').max(120),
  full_name:      z.string().min(1, 'Full name is required').max(120),
  email:          z.string().email('Enter a valid email'),
  password:       z.string().min(8, 'Password must be at least 8 characters'),
})

async function uniqueSlug(base: string): Promise<string> {
  const slug = slugify(base)
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`
    const { data } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()
    if (!data) return candidate
  }
  return `${slug}-${Date.now().toString(36)}`
}

export async function POST(request: NextRequest) {
  if (!isSignupEnabled()) {
    return NextResponse.json({ error: 'Public signup is disabled. Contact sales.' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0]
    return NextResponse.json({ error: msg ?? 'Invalid input' }, { status: 400 })
  }

  const { workspace_name, full_name, email, password } = parsed.data

  const slug = await uniqueSlug(workspace_name)
  const { data: trialPlan } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .eq('slug', 'trial')
    .maybeSingle()

  const trialDays = trialPlan?.trial_days || TRIAL_DAYS
  const trialEnds = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .insert({
      name: workspace_name,
      slug,
      plan: 'trial',
      plan_id: trialPlan?.id ?? null,
      status: 'trial',
      seat_limit: trialPlan?.seat_limit ?? PLAN_SEAT_LIMITS.trial,
      trial_ends_at: trialEnds,
      billing_email: email,
    })
    .select()
    .single()

  if (orgError || !org) {
    return NextResponse.json(
      { error: orgError?.message ?? 'Could not create workspace' },
      { status: 500 },
    )
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name,
      role: 'admin',
      organization_id: org.id,
    },
  })

  if (authError || !authData.user) {
    await supabaseAdmin.from('organizations').delete().eq('id', org.id)
    return NextResponse.json(
      { error: authError?.message ?? 'Could not create account' },
      { status: 500 },
    )
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: authData.user.id,
      full_name,
      email,
      role: 'admin',
      organization_id: org.id,
    }, { onConflict: 'id' })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    await supabaseAdmin.from('organizations').delete().eq('id', org.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    message: 'Workspace created. Sign in with your email and password.',
    slug: org.slug,
  }, { status: 201 })
}
