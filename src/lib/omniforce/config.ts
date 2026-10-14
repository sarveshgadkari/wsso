// Omni Force Vector integration settings (server-only).
// Sign-in through Omni Force Vector is offered only when every required value is set.

const trim = (v: string | undefined) => (v ?? '').trim().replace(/\/+$/, '')

export function omniforceConfig() {
  const issuer = trim(process.env.OMNIFORCE_ISSUER)
  return {
    /** e.g. https://<hub-ref>.supabase.co/functions/v1/oidc */
    issuer,
    clientId: (process.env.OMNIFORCE_CLIENT_ID ?? '').trim(),
    clientSecret: (process.env.OMNIFORCE_CLIENT_SECRET ?? '').trim(),
    /** Server-to-server API for account linking and access checks. */
    integrationApiUrl: trim(process.env.OMNIFORCE_INTEGRATION_API_URL) || issuer.replace(/\/oidc$/, '/integration-api'),
    /** Shared secret for signed events sent by Omni Force Vector. */
    eventsSecret: (process.env.OMNIFORCE_EVENTS_SECRET ?? '').trim(),
    /** Where people manage their Omni Force Vector account. */
    hubUrl: trim(process.env.NEXT_PUBLIC_OMNIFORCE_HUB_URL),
  }
}

export function omniforceSsoEnabled(): boolean {
  const c = omniforceConfig()
  return /^https:\/\//.test(c.issuer) && c.clientId.length > 0 && c.clientSecret.length >= 32
}

export function omniforceEventsEnabled(): boolean {
  return omniforceConfig().eventsSecret.length >= 32
}
