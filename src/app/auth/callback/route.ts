import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Handles two patterns Supabase uses in email links:
//   1. PKCE code exchange  (OAuth / magic link)  → ?code=xxx
//   2. OTP token hash      (password reset / email confirm) → ?token_hash=xxx&type=recovery
//
// The `next` param (default /dashboard) controls where the user lands after the exchange.

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as 'recovery' | 'signup' | 'email' | null
  const next       = searchParams.get('next') ?? '/dashboard'

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=Your+link+has+expired+or+is+invalid.+Please+try+again.`
  )
}
