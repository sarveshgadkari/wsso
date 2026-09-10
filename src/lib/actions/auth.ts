'use server'

import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildSetPasswordCallbackUrl, appBaseUrl } from '@/lib/auth/set-password-link'
import { sendPasswordResetEmail } from '@/lib/email/send-set-password-email'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})

function isUnknownUser(message: string): boolean {
  const msg = message.toLowerCase()
  return (
    msg.includes('user not found') ||
    msg.includes('unable to find user') ||
    msg.includes('email address has not been registered')
  )
}

function isRateLimited(message: string): boolean {
  const msg = message.toLowerCase()
  return msg.includes('security purposes') || msg.includes('seconds') || msg.includes('rate')
}

/**
 * Sends a password-reset email via Brevo using a hashed recovery token.
 * Avoids Supabase Auth's built-in mailer (often undelivered) and PKCE
 * (fails when the link is opened on another device).
 */
export async function requestPasswordReset(email: string): Promise<{ error?: string }> {
  const parsed = schema.safeParse({ email: email.trim().toLowerCase() })
  if (!parsed.success) {
    return { error: 'Enter a valid email address' }
  }

  const normalized = parsed.data.email
  const appUrl = appBaseUrl()

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email: normalized,
    options: {
      redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
    },
  })

  if (linkError) {
    if (isUnknownUser(linkError.message)) {
      return {}
    }
    if (isRateLimited(linkError.message)) {
      return { error: 'Please wait a minute before requesting another reset email.' }
    }
    console.error('[forgot-password] generateLink failed:', linkError.message)
    return { error: 'Could not send a reset email. Please try again.' }
  }

  const link = linkData?.properties?.hashed_token
    ? buildSetPasswordCallbackUrl(linkData.properties.hashed_token)
    : linkData?.properties?.action_link ?? null

  if (!link) {
    console.error('[forgot-password] generateLink returned no link')
    return { error: 'Could not send a reset email. Please try again.' }
  }

  const result = await sendPasswordResetEmail({ email: normalized, link })
  if (!result.sent) {
    console.error('[forgot-password] email send failed:', result.error)
    return { error: 'Could not send a reset email. Please try again or contact support.' }
  }

  return {}
}
