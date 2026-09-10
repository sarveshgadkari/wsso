import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

// Handles Supabase auth redirects:
//   1. PKCE code exchange     → ?code=xxx
//   2. OTP token hash (SSR)   → ?token_hash=xxx&type=recovery
//   3. Hash tokens (implicit) → no query params; hand off to /reset-password

function safeNextPath(next: string | null, fallback: string): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback
  return next
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as EmailOtpType | null
  const isRecovery = type === 'recovery' || searchParams.get('next') === '/reset-password'
  const next       = safeNextPath(searchParams.get('next'), isRecovery ? '/reset-password' : '/dashboard')

  const response = NextResponse.redirect(`${origin}${next}`)

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

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return response
    console.error('[auth/callback] exchangeCodeForSession failed:', error.message)
  }

  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      if (data.session) {
        await supabase.auth.setSession({
          access_token:  data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
      }
      return response
    }
    console.error('[auth/callback] verifyOtp failed:', error.message)
  }

  // Implicit-flow emails put tokens in the URL hash, which the server never sees.
  // Land on the client reset page so detectSessionInUrl can recover them.
  if (!code && !token_hash) {
    return NextResponse.redirect(`${origin}/reset-password`)
  }

  return NextResponse.redirect(`${origin}/login?error=link_expired`)
}
