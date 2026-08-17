import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Returns MCP connection details for the currently signed-in user.
 * Used by the Connect AI page so non-technical users never open DevTools.
 *
 * Auth: same session cookies as the WSSO web app.
 * The token is only returned to the browser that already owns the session.
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

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    return NextResponse.json(
      { error: 'No active session. Sign out and sign in again.' },
      { status: 401 },
    )
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://wsso.vercel.app').replace(/\/$/, '')
  const mcpUrl = `${appUrl}/api/mcp/mcp`

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, employee_code')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    mcpUrl,
    accessToken: session.access_token,
    expiresAt: session.expires_at ?? null,
    expiresInSeconds: session.expires_at
      ? Math.max(0, session.expires_at - Math.floor(Date.now() / 1000))
      : null,
    user: {
      id: user.id,
      email: user.email ?? null,
      fullName: profile?.full_name ?? null,
      role: profile?.role ?? null,
      employeeCode: profile?.employee_code ?? null,
    },
    /** Ready to paste into Workforce 2.0 / Cursor / any MCP HTTP client */
    clientConfig: {
      name: 'wsso',
      url: mcpUrl,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  })
}
