// Server-to-server calls to the Omni Force Vector integration API (client credentials).
import { omniforceConfig } from './config'

async function call(body: Record<string, unknown>) {
  const { integrationApiUrl, clientId, clientSecret } = omniforceConfig()
  const res = await fetch(integrationApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString('base64')}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  return { ok: res.ok, status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> }
}

/**
 * Tell Omni Force Vector which WSSO account (and, for an organization's workspace,
 * which WSSO workspace) this person is. Accepted only right after they signed in
 * through Omni Force Vector. Best effort: sign-in never fails because of it.
 */
export async function linkIdentity(sub: string, wssoUserId: string, wssoOrgId?: string) {
  try {
    const r = await call({ action: 'link_identity', sub, external_user_id: wssoUserId, ...(wssoOrgId ? { external_org_id: wssoOrgId } : {}) })
    if (!r.ok) console.warn('[omniforce] link_identity', r.status, r.json.error)
  } catch (e) {
    console.warn('[omniforce] link_identity failed', (e as Error).message)
  }
}

/** Central access check (e.g. before seat-limited actions). */
export async function checkAccess(sub: string, wssoOrgId?: string) {
  const r = await call({ action: 'check_access', sub, ...(wssoOrgId ? { external_org_id: wssoOrgId } : {}) })
  return r.json as { active: boolean; reason?: string; seats?: number | null; plan_ref?: string | null }
}
