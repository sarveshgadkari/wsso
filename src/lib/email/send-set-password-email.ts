import nodemailer from 'nodemailer'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { appBaseUrl } from '@/lib/auth/set-password-link'

const DEFAULT_FROM = 'TLB Enterprise <support@tlbisbig.world>'

export interface SetPasswordEmailParams {
  email:         string
  fullName:      string
  role:          string
  employeeCode:  string
  setPasswordLink: string | null
}

export interface SetPasswordEmailResult {
  sent:   boolean
  method: 'brevo' | 'supabase' | 'none'
  error?: string
}

function appRedirectUrl(): string {
  return `${appBaseUrl()}/auth/callback?next=/reset-password`
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

function brevoConfigured(): boolean {
  return !!(process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_PASSWORD)
}

async function sendViaBrevo(
  params: SetPasswordEmailParams,
  link: string,
): Promise<SetPasswordEmailResult> {
  if (!brevoConfigured()) {
    return {
      sent:   false,
      method: 'none',
      error:  'BREVO_SMTP_USER and BREVO_SMTP_PASSWORD not configured',
    }
  }

  const host = process.env.BREVO_SMTP_HOST ?? 'smtp-relay.brevo.com'
  const port = Number(process.env.BREVO_SMTP_PORT ?? '587')
  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user: process.env.BREVO_SMTP_USER,
      pass: process.env.BREVO_SMTP_PASSWORD,
    },
  })

  try {
    await transport.sendMail({
      from,
      to:      params.email,
      subject: 'Set up your WSSO account',
      html:    welcomeHtml(params, link),
    })
    return { sent: true, method: 'brevo' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Brevo SMTP send failed'
    return { sent: false, method: 'brevo', error: message }
  }
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

/**
 * Sends the new employee a set-password email via Brevo SMTP.
 * When a link was already generated (admin create-user), only Brevo is used —
 * do not call Supabase resetPasswordForEmail or it hits the 60s rate limit.
 */
export async function sendSetPasswordEmail(
  params: SetPasswordEmailParams,
): Promise<SetPasswordEmailResult> {
  const link = params.setPasswordLink

  if (link) {
    if (!brevoConfigured()) {
      return {
        sent:   false,
        method: 'none',
        error:  'Brevo SMTP not configured — add BREVO_SMTP_USER and BREVO_SMTP_PASSWORD in Vercel',
      }
    }
    return sendViaBrevo(params, link)
  }

  return sendViaSupabase(params)
}
