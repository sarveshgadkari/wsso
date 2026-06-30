import { supabaseAdmin } from '@/lib/supabase/admin'

export interface SetPasswordEmailParams {
  email:         string
  fullName:      string
  role:          string
  employeeCode:  string
  setPasswordLink: string | null
}

export interface SetPasswordEmailResult {
  sent:   boolean
  method: 'resend' | 'supabase' | 'none'
  error?: string
}

function appRedirectUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${appUrl}/auth/callback?next=/reset-password`
}

function welcomeHtml(params: SetPasswordEmailParams, link: string): string {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#171717">
      <h1 style="font-size:20px;margin-bottom:8px">Welcome to WSSO</h1>
      <p>Hi ${params.fullName},</p>
      <p>Your administrator created a WSSO account for you.</p>
      <ul style="padding-left:18px;line-height:1.6">
        <li><strong>Email:</strong> ${params.email}</li>
        <li><strong>Employee code:</strong> ${params.employeeCode}</li>
        <li><strong>Role:</strong> ${params.role}</li>
      </ul>
      <p>Click the button below to set your password. After that, sign in with your email and the password you choose.</p>
      <p style="margin:28px 0">
        <a href="${link}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
          Set your password
        </a>
      </p>
      <p style="font-size:12px;color:#737373">If the button does not work, copy and paste this link into your browser:</p>
      <p style="font-size:12px;color:#737373;word-break:break-all">${link}</p>
      <p style="font-size:12px;color:#737373;margin-top:24px">This link expires after a short time. If it expires, use Forgot password on the login page.</p>
    </div>
  `.trim()
}

async function sendViaResend(
  params: SetPasswordEmailParams,
  link: string,
): Promise<SetPasswordEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { sent: false, method: 'none', error: 'RESEND_API_KEY not configured' }

  const from = process.env.EMAIL_FROM ?? 'WSSO <onboarding@resend.dev>'

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to:      [params.email],
      subject: 'Set up your WSSO account',
      html:    welcomeHtml(params, link),
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    return { sent: false, method: 'resend', error: body || `Resend HTTP ${res.status}` }
  }

  return { sent: true, method: 'resend' }
}

async function sendViaSupabase(params: SetPasswordEmailParams): Promise<SetPasswordEmailResult> {
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(params.email, {
    redirectTo: appRedirectUrl(),
  })

  if (error) {
    return {
      sent:   false,
      method: 'supabase',
      error:  error.message,
    }
  }

  return { sent: true, method: 'supabase' }
}

/** Sends the new employee a set-password email via Resend (preferred) or Supabase Auth. */
export async function sendSetPasswordEmail(
  params: SetPasswordEmailParams,
): Promise<SetPasswordEmailResult> {
  const link = params.setPasswordLink

  if (process.env.RESEND_API_KEY) {
    if (!link) {
      return { sent: false, method: 'none', error: 'Set-password link could not be generated' }
    }
    const resendResult = await sendViaResend(params, link)
    if (resendResult.sent) return resendResult
    // Fall back to Supabase if Resend fails
    const supabaseResult = await sendViaSupabase(params)
    if (supabaseResult.sent) return supabaseResult
    return {
      sent:   false,
      method: 'none',
      error:  supabaseResult.error ?? resendResult.error,
    }
  }

  return sendViaSupabase(params)
}
