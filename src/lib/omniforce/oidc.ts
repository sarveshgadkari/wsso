// "Sign in with Omni Force Vector" — OpenID Connect authorization code + PKCE. Server-only module.
// Contract: omniforce/docs/INTEGRATION_AUTH.md
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { omniforceConfig } from './config'

export const SCOPES = 'openid profile email organizations entitlements'
export const STATE_COOKIE = 'wsso_omniforce_oidc'
const STATE_TTL_SECONDS = 600

export type OmniforceClaims = {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string
  given_name?: string
  family_name?: string
  org?: { id: string; slug: string; name: string; role: 'owner' | 'admin' | 'billing' | 'member'; external_id: string | null }
  omniforce_access?: {
    module: string
    via: 'individual' | 'organization'
    status: string
    plan: string | null
    plan_ref: string | null
    seats: number | null
    valid_until: number | null
  }
  module_user_id?: string | null
}

type Discovery = { issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string }

let discoveryCache: { at: number; value: Discovery } | null = null
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

export async function discovery(): Promise<Discovery> {
  if (discoveryCache && Date.now() - discoveryCache.at < 10 * 60_000) return discoveryCache.value
  const { issuer } = omniforceConfig()
  const res = await fetch(`${issuer}/.well-known/openid-configuration`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`discovery failed: ${res.status}`)
  const d = (await res.json()) as Discovery
  // mix-up defence: the document must describe the issuer we were configured with
  if (d.issuer !== issuer) throw new Error('discovery issuer mismatch')
  discoveryCache = { at: Date.now(), value: d }
  return d
}

const b64url = (b: Buffer) => b.toString('base64url')

export function newPkce() {
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export const randomToken = () => b64url(randomBytes(32))

// ─── state cookie: tamper-proof (HMAC with the client secret) and short-lived

type FlowState = { state: string; nonce: string; verifier: string; next: string; exp: number }

export function sealState(s: Omit<FlowState, 'exp'>): string {
  const body = b64url(Buffer.from(JSON.stringify({ ...s, exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS })))
  const mac = b64url(createHmac('sha256', omniforceConfig().clientSecret).update(body).digest())
  return `${body}.${mac}`
}

export function openState(value: string | undefined): FlowState | null {
  if (!value) return null
  const [body, mac] = value.split('.')
  if (!body || !mac) return null
  const expected = createHmac('sha256', omniforceConfig().clientSecret).update(body).digest()
  const given = Buffer.from(mac, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const s = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as FlowState
    return s.exp > Math.floor(Date.now() / 1000) ? s : null
  } catch {
    return null
  }
}

export const stateCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,   // must survive the top-level redirect back from Omni Force Vector
  path: '/auth/omniforce',
  maxAge: STATE_TTL_SECONDS,
}

// ─── token exchange + ID token verification

export async function exchangeCode(code: string, verifier: string, redirectUri: string) {
  const { clientId, clientSecret } = omniforceConfig()
  const d = await discovery()
  const res = await fetch(d.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || typeof json.id_token !== 'string') {
    throw new Error(`token exchange failed: ${json.error ?? res.status}`)
  }
  return json as { id_token: string; access_token: string }
}

export async function verifyIdToken(idToken: string, nonce: string): Promise<OmniforceClaims> {
  const { issuer, clientId } = omniforceConfig()
  const d = await discovery()
  jwks ??= createRemoteJWKSet(new URL(d.jwks_uri), { cacheMaxAge: 5 * 60_000 })
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer,
    audience: clientId,
    algorithms: ['ES256'],
    clockTolerance: 10,
  })
  if (payload.nonce !== nonce) throw new Error('nonce mismatch')
  if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('missing sub')
  return payload as unknown as OmniforceClaims
}

/** Same-origin path to continue to after sign-in (never an open redirect). */
export function safeNext(target: string | null, appOrigin: string): string {
  if (!target) return '/dashboard'
  try {
    const u = new URL(target, appOrigin)
    if (u.origin !== appOrigin || !u.pathname.startsWith('/') || u.pathname.startsWith('//')) return '/dashboard'
    return u.pathname + u.search
  } catch {
    return '/dashboard'
  }
}
