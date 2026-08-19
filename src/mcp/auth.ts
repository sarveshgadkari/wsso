import { createClient } from '@supabase/supabase-js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import type { Database, Profile } from '@/lib/types'
import {
  isMcpLongLivedToken,
  resolveMcpLongLivedToken,
} from '@/lib/mcp/long-lived-token'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type McpAuthExtra = {
  profile: Profile
}

export type McpAuthInfo = AuthInfo & {
  extra: McpAuthExtra
}

/** Supabase client scoped to the caller's JWT — RLS applies as for that user. */
export function createMcpUserClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

/**
 * Validates Bearer token for MCP:
 * 1) Long-lived `wsso_mcp_…` Connect AI token (30 days), or
 * 2) Normal Supabase access JWT (short-lived session).
 */
export async function verifyMcpToken(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined

  if (isMcpLongLivedToken(bearerToken)) {
    try {
      const resolved = await resolveMcpLongLivedToken(bearerToken)
      if (!resolved) return undefined

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', resolved.userId)
        .single()

      if (profileError || !profile) return undefined
      if (profile.status === 'inactive') return undefined

      return {
        token: resolved.supabaseJwt,
        clientId: profile.id,
        scopes: [`role:${profile.role}`, 'mcp:long_lived'],
        extra: { profile } satisfies McpAuthExtra,
      }
    } catch {
      return undefined
    }
  }

  const supabase = createMcpUserClient(bearerToken)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(bearerToken)

  if (userError || !user) return undefined

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) return undefined
  if (profile.status === 'inactive') return undefined

  return {
    token: bearerToken,
    clientId: profile.id,
    scopes: [`role:${profile.role}`],
    extra: { profile } satisfies McpAuthExtra,
  }
}

export function getMcpAuth(extra: { authInfo?: AuthInfo }): McpAuthInfo {
  const auth = extra.authInfo as McpAuthInfo | undefined
  if (!auth?.token || !auth.extra?.profile) {
    throw new Error('Unauthorized: missing or invalid MCP session')
  }
  return auth
}

export function getMcpClient(extra: { authInfo?: AuthInfo }) {
  const auth = getMcpAuth(extra)
  return {
    supabase: createMcpUserClient(auth.token),
    profile: auth.extra.profile,
    auth,
  }
}
