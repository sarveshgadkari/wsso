// "Sign in with Omni Force Vector" — unit tests for the WSSO side of the contract.
// Omni Force Vector is simulated with a mocked fetch: discovery, JWKS and a token
// endpoint that enforces client authentication and PKCE like the real one.
// Run: npm run test:omniforce
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, createHmac, webcrypto } from 'crypto'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'

type KeyLike = CryptoKey

const ISSUER = 'https://hub.example.test/functions/v1/oidc'
const CLIENT_ID = 'ofc_test'
const SECRET = 's'.repeat(40)
const REDIRECT = 'https://wsso.example.test/auth/omniforce/callback'
process.env.OMNIFORCE_ISSUER = ISSUER
process.env.OMNIFORCE_CLIENT_ID = CLIENT_ID
process.env.OMNIFORCE_CLIENT_SECRET = SECRET
process.env.OMNIFORCE_EVENTS_SECRET = 'e'.repeat(40)

// eslint-disable-next-line @typescript-eslint/no-require-imports
const oidc = require('../src/lib/omniforce/oidc') as typeof import('../src/lib/omniforce/oidc')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { signatureOk } = require('../src/lib/omniforce/signature') as typeof import('../src/lib/omniforce/signature')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { omniforceSsoEnabled } = require('../src/lib/omniforce/config') as typeof import('../src/lib/omniforce/config')

let key: KeyLike
let otherKey: KeyLike
const codes = new Map<string, { challenge: string; claims: Record<string, unknown> }>()
const b64url = (b: Buffer) => b.toString('base64url')

async function idToken(claims: Record<string, unknown>, opts: { k?: KeyLike; iss?: string; aud?: string } = {}) {
  return new SignJWT({ nonce: 'n-1', ...claims })
    .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
    .setIssuer(opts.iss ?? ISSUER).setAudience(opts.aud ?? CLIENT_ID).setSubject(String(claims.sub ?? 'of_user'))
    .setIssuedAt().setExpirationTime('5m')
    .sign(opts.k ?? key)
}

before(async () => {
  ;({ privateKey: key } = await generateKeyPair('ES256', { extractable: true }))
  ;({ privateKey: otherKey } = await generateKeyPair('ES256'))
  const pub = { ...(await exportJWK(key)), kid: 'k1', alg: 'ES256', use: 'sig' }
  delete (pub as { d?: string }).d

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (url === `${ISSUER}/.well-known/openid-configuration`) {
      return json({ issuer: ISSUER, authorization_endpoint: `${ISSUER}/authorize`, token_endpoint: `${ISSUER}/token`, jwks_uri: `${ISSUER}/jwks` })
    }
    if (url === `${ISSUER}/jwks`) return json({ keys: [pub] })
    if (url === `${ISSUER}/token`) {
      const auth = new Headers(init?.headers).get('authorization') ?? ''
      if (auth !== `Basic ${Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64')}`) return json({ error: 'invalid_client' }, 401)
      const form = new URLSearchParams(String(init?.body))
      const c = codes.get(form.get('code') ?? '')
      if (!c || form.get('grant_type') !== 'authorization_code' || form.get('redirect_uri') !== REDIRECT) return json({ error: 'invalid_grant' }, 400)
      if (b64url(createHash('sha256').update(form.get('code_verifier') ?? '').digest()) !== c.challenge) return json({ error: 'invalid_grant' }, 400)
      codes.delete(form.get('code')!)
      return json({ id_token: await idToken(c.claims), access_token: 'at', token_type: 'Bearer' })
    }
    return json({ error: 'not_found' }, 404)
  }) as typeof fetch
})

test('configuration: sign-in is offered only with an https issuer, a client id and a long secret', () => {
  assert.equal(omniforceSsoEnabled(), true)
  process.env.OMNIFORCE_CLIENT_SECRET = 'short'
  assert.equal(omniforceSsoEnabled(), false)
  process.env.OMNIFORCE_CLIENT_SECRET = SECRET
  process.env.OMNIFORCE_ISSUER = 'http://hub.example.test/functions/v1/oidc'
  assert.equal(omniforceSsoEnabled(), false)
  process.env.OMNIFORCE_ISSUER = ISSUER
})

test('full sign-in: code + PKCE verifier + client secret → verified claims', async () => {
  const pkce = oidc.newPkce()
  assert.equal(pkce.challenge, b64url(createHash('sha256').update(pkce.verifier).digest()))
  const claims = { sub: 'of_123', email: 'pat@x.test', email_verified: true, omniforce_access: { module: 'wsso', via: 'individual' } }
  codes.set('code-1', { challenge: pkce.challenge, claims })
  const tokens = await oidc.exchangeCode('code-1', pkce.verifier, REDIRECT)
  const verified = await oidc.verifyIdToken(tokens.id_token, 'n-1')
  assert.equal(verified.sub, 'of_123')
  assert.equal(verified.omniforce_access?.module, 'wsso')
  // single use
  await assert.rejects(oidc.exchangeCode('code-1', pkce.verifier, REDIRECT), /invalid_grant/)
})

test('a wrong PKCE verifier is refused', async () => {
  const pkce = oidc.newPkce()
  codes.set('code-2', { challenge: pkce.challenge, claims: { sub: 'of_1' } })
  await assert.rejects(oidc.exchangeCode('code-2', oidc.newPkce().verifier, REDIRECT), /invalid_grant/)
})

test('ID tokens: nonce, issuer, audience and signing key are all checked', async () => {
  await assert.rejects(oidc.verifyIdToken(await idToken({ sub: 'of_1' }), 'other-nonce'), /nonce/)
  await assert.rejects(oidc.verifyIdToken(await idToken({ sub: 'of_1' }, { iss: 'https://evil.test/oidc' }), 'n-1'))
  await assert.rejects(oidc.verifyIdToken(await idToken({ sub: 'of_1' }, { aud: 'ofc_someone_else' }), 'n-1'))
  await assert.rejects(oidc.verifyIdToken(await idToken({ sub: 'of_1' }, { k: otherKey }), 'n-1'))
  assert.equal((await oidc.verifyIdToken(await idToken({ sub: 'of_1' }), 'n-1')).sub, 'of_1')
})

test('state cookie: round-trips, and is refused when tampered with or expired', () => {
  const sealed = oidc.sealState({ state: 's', nonce: 'n', verifier: 'v', next: '/dashboard' })
  assert.equal(oidc.openState(sealed)?.verifier, 'v')
  const [body, mac] = sealed.split('.')
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), next: '/admin' })).toString('base64url')
  assert.equal(oidc.openState(`${forged}.${mac}`), null)
  assert.equal(oidc.openState(undefined), null)
  assert.equal(oidc.openState('garbage'), null)
  const realNow = Date.now
  Date.now = () => realNow() + 601_000
  try {
    assert.equal(oidc.openState(sealed), null)
  } finally {
    Date.now = realNow
  }
})

test('safeNext: only same-origin paths', () => {
  const app = 'https://wsso.example.test'
  assert.equal(oidc.safeNext(null, app), '/dashboard')
  assert.equal(oidc.safeNext('/tasks?view=mine', app), '/tasks?view=mine')
  assert.equal(oidc.safeNext('https://wsso.example.test/settings', app), '/settings')
  assert.equal(oidc.safeNext('https://evil.test/phish', app), '/dashboard')
  assert.equal(oidc.safeNext('//evil.test/phish', app), '/dashboard')
  assert.equal(oidc.safeNext('javascript:alert(1)', app), '/dashboard')
})

test('event signatures: accepts exactly what Omni Force Vector signs (WebCrypto HMAC), nothing else', async () => {
  const secret = 'e'.repeat(40)
  const body = JSON.stringify({ event_id: 'evt-1', event: 'access.revoked', sub: 'of_1' })
  const now = 1_790_000_000_000
  const ts = String(Math.floor(now / 1000))
  // same computation as the hub's hmacHex() (supabase/functions/_shared/wsso.ts)
  const k = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = Buffer.from(await webcrypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${ts}.${body}`))).toString('hex')
  assert.equal(sig, createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex'))

  assert.equal(signatureOk(body, ts, sig, secret, now), true)
  assert.equal(signatureOk(body + ' ', ts, sig, secret, now), false)
  assert.equal(signatureOk(body, ts, sig, 'x'.repeat(40), now), false)
  assert.equal(signatureOk(body, ts, sig, secret, now + 301_000), false)
  assert.equal(signatureOk(body, 'abc', sig, secret, now), false)
  assert.equal(signatureOk(body, ts, sig.slice(0, 62), secret, now), false)
  assert.equal(signatureOk(body, ts, 'zz' + sig.slice(2), secret, now), false)
  assert.equal(signatureOk(body, ts, sig, '', now), false)
})
