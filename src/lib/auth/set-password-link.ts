/** Public app base URL for auth redirects and invite emails. */
export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://wsso.vercel.app'
}

/**
 * Direct app callback link for SSR password setup (avoids supabase.co/auth/v1/verify).
 * Uses hashed_token from auth.admin.generateLink().
 */
export function buildSetPasswordCallbackUrl(hashedToken: string): string {
  const params = new URLSearchParams({
    token_hash: hashedToken,
    type:       'recovery',
    next:       '/reset-password',
  })
  return `${appBaseUrl()}/auth/callback?${params.toString()}`
}
