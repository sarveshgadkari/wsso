// GET /auth/omniforce/callback — finish "Sign in with Omni Force Vector".
// Verifies state + issuer, exchanges the code (PKCE + client secret), verifies the
// ID token, finds or creates the WSSO account, then starts a normal WSSO session.
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { appBaseUrl } from '@/lib/auth/set-password-link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { omniforceConfig, omniforceSsoEnabled } from '@/lib/omniforce/config'
import { exchangeCode, openState, STATE_COOKIE, stateCookieOptions, verifyIdToken } from '@/lib/omniforce/oidc'
import { AccountError, resolveAccount } from '@/lib/omniforce/accounts'
import { linkIdentity } from '@/lib/omniforce/integration'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const app = appBaseUrl()
  const fail = (code: string) => {
    const r = NextResponse.redirect(`${app}/login?error=omniforce_${code}`)
    r.cookies.set(STATE_COOKIE, '', { ...stateCookieOptions, maxAge: 0 })
    return r
  }
  if (!omniforceSsoEnabled()) return fail('unavailable')

  const p = request.nextUrl.searchParams
  const flow = openState(request.cookies.get(STATE_COOKIE)?.value)
  // CSRF / mix-up: the response must answer the request this browser started, from our issuer
  if (!flow || p.get('state') !== flow.state) return fail('expired')
  if (p.get('iss') && p.get('iss') !== omniforceConfig().issuer) return fail('failed')
  if (p.get('error')) return fail(p.get('error') === 'access_denied' ? 'denied' : 'failed')
  const code = p.get('code')
  if (!code) return fail('failed')

  let account
  let claims
  try {
    const tokens = await exchangeCode(code, flow.verifier, `${app}/auth/omniforce/callback`)
    claims = await verifyIdToken(tokens.id_token, flow.nonce)
    account = await resolveAccount(claims)
  } catch (e) {
    if (e instanceof AccountError) return fail(e.code)
    console.error('[omniforce/callback]', (e as Error).message)
    return fail('failed')
  }

  // One-time login token for this account, consumed right here (never emailed, never sent to the browser).
  const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email: account.email })
  if (linkError || !link.properties?.hashed_token) {
    console.error('[omniforce/callback] generateLink', linkError?.message)
    return fail('failed')
  }

  const response = NextResponse.redirect(`${app}${flow.next}`)
  response.cookies.set(STATE_COOKIE, '', { ...stateCookieOptions, maxAge: 0 })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )
  const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' })
  if (otpError) {
    console.error('[omniforce/callback] verifyOtp', otpError.message)
    return fail('failed')
  }

  // Report the WSSO account (and, for an organization, its workspace) back to Omni Force Vector.
  // Omni Force Vector only lets an owner/admin bind an organization to a new workspace;
  // members can only confirm the workspace the organization is already bound to.
  const orgContext = claims.org ? account.organizationId : undefined
  if (claims.module_user_id !== account.userId || (orgContext && claims.org?.external_id !== orgContext)) {
    await linkIdentity(claims.sub, account.userId, orgContext)
  }
  return response
}
