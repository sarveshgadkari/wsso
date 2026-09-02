import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  MCP_TOKEN_TTL_DAYS,
  createMcpToken,
  decryptMcpToken,
  getActiveMcpToken,
} from '@/lib/mcp/long-lived-token'

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://wsso.tlbisbig.world').replace(/\/$/, '')
}

function buildPayload(opts: {
  mcpUrl: string
  accessToken: string
  expiresAt: string | null
  user: {
    id: string
    email: string | null
    fullName: string | null
    role: string | null
    employeeCode: string | null
  }
  tokenType: 'mcp_long_lived' | 'session'
}) {
  const expiresAtSec = opts.expiresAt
    ? Math.floor(new Date(opts.expiresAt).getTime() / 1000)
    : null
  const expiresInSeconds = expiresAtSec
    ? Math.max(0, expiresAtSec - Math.floor(Date.now() / 1000))
    : null

  const workforceArgs =
    `-y mcp-remote ${opts.mcpUrl} --header Authorization: Bearer ${opts.accessToken}`

  return {
    mcpUrl: opts.mcpUrl,
    accessToken: opts.accessToken,
    tokenType: opts.tokenType,
    ttlDays: opts.tokenType === 'mcp_long_lived' ? MCP_TOKEN_TTL_DAYS : null,
    expiresAt: expiresAtSec,
    expiresInSeconds,
    user: opts.user,
    clientConfig: {
      name: 'wsso',
      url: opts.mcpUrl,
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
      },
    },
    /** Ready for Workforce Custom MCP (Command = npx) */
    workforceCustomMcp: {
      serverId: 'wsso',
      command: 'npx',
      args: workforceArgs,
    },
  }
}

/**
 * GET — return connection details for Connect AI (long-lived MCP token preferred).
 * POST — rotate / create a new 30-day MCP token.
 */
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, employee_code')
    .eq('id', user.id)
    .single()

  const userInfo = {
    id: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? null,
    role: profile?.role ?? null,
    employeeCode: profile?.employee_code ?? null,
  }

  const mcpUrl = `${appBaseUrl()}/api/mcp/mcp`

  try {
    let active = await getActiveMcpToken(user.id)
    let rawToken: string

    if (active) {
      rawToken = decryptMcpToken(active.token_encrypted)
    } else {
      const created = await createMcpToken(user.id)
      active = created.record
      rawToken = created.rawToken
    }

    return NextResponse.json(
      buildPayload({
        mcpUrl,
        accessToken: rawToken,
        expiresAt: active.expires_at,
        user: userInfo,
        tokenType: 'mcp_long_lived',
      }),
    )
  } catch (err) {
    // Fallback: short session JWT if long-lived setup is not ready (migration / JWT secret)
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : 'Could not create MCP token. Run migration and set SUPABASE_JWT_SECRET.',
        },
        { status: 500 },
      )
    }

    return NextResponse.json(
      buildPayload({
        mcpUrl,
        accessToken: session.access_token,
        expiresAt: session.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : null,
        user: userInfo,
        tokenType: 'session',
      }),
    )
  }
}

/** Rotate token — invalidates previous long-lived token. */
export async function POST() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, employee_code')
    .eq('id', user.id)
    .single()

  const mcpUrl = `${appBaseUrl()}/api/mcp/mcp`

  try {
    const created = await createMcpToken(user.id)
    return NextResponse.json(
      buildPayload({
        mcpUrl,
        accessToken: created.rawToken,
        expiresAt: created.record.expires_at,
        user: {
          id: user.id,
          email: user.email ?? null,
          fullName: profile?.full_name ?? null,
          role: profile?.role ?? null,
          employeeCode: profile?.employee_code ?? null,
        },
        tokenType: 'mcp_long_lived',
      }),
    )
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Could not rotate MCP token',
      },
      { status: 500 },
    )
  }
}
