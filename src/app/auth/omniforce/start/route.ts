// GET /auth/omniforce/start — begin "Sign in with Omni Force Vector".
// Reached from the WSSO login button, or from "Open WSSO" in the Omni Force Vector
// dashboard (OIDC third-party initiated login: ?iss=…&login_hint=…&target_link_uri=…).
import { NextResponse, type NextRequest } from 'next/server'
import { appBaseUrl } from '@/lib/auth/set-password-link'
import { omniforceConfig, omniforceSsoEnabled } from '@/lib/omniforce/config'
import { discovery, newPkce, randomToken, safeNext, sealState, SCOPES, STATE_COOKIE, stateCookieOptions } from '@/lib/omniforce/oidc'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const app = appBaseUrl()
  if (!omniforceSsoEnabled()) return NextResponse.redirect(`${app}/login?error=omniforce_unavailable`)

  const params = request.nextUrl.searchParams
  const iss = params.get('iss')
  if (iss && iss.replace(/\/+$/, '') !== omniforceConfig().issuer) {
    return NextResponse.redirect(`${app}/login?error=omniforce_failed`)
  }

  let authorizeUrl: URL
  try {
    authorizeUrl = new URL((await discovery()).authorization_endpoint)
  } catch (e) {
    console.error('[omniforce/start]', (e as Error).message)
    return NextResponse.redirect(`${app}/login?error=omniforce_unavailable`)
  }

  const state = randomToken()
  const nonce = randomToken()
  const pkce = newPkce()
  const next = safeNext(params.get('target_link_uri'), new URL(app).origin)

  const q = authorizeUrl.searchParams
  q.set('response_type', 'code')
  q.set('client_id', omniforceConfig().clientId)
  q.set('redirect_uri', `${app}/auth/omniforce/callback`)
  q.set('scope', SCOPES)
  q.set('state', state)
  q.set('nonce', nonce)
  q.set('code_challenge', pkce.challenge)
  q.set('code_challenge_method', 'S256')
  const hint = params.get('login_hint')
  if (hint && hint.length <= 254) q.set('login_hint', hint)

  const res = NextResponse.redirect(authorizeUrl.toString())
  res.cookies.set(STATE_COOKIE, sealState({ state, nonce, verifier: pkce.verifier, next }), stateCookieOptions)
  return res
}
