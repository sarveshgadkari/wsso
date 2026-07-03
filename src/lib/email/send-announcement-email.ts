import nodemailer from 'nodemailer'

const DEFAULT_FROM = 'TLB Enterprise <support@tlbisbig.world>'

export interface AnnouncementEmailParams {
  subject: string
  body:    string
  bcc:     string[]
}

export interface AnnouncementEmailResult {
  sent:   boolean
  error?: string
}

function brevoConfigured(): boolean {
  return !!(process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_PASSWORD)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function bodyToHtml(body: string): string {
  return escapeHtml(body).replace(/\n/g, '<br>')
}

function announcementHtml(subject: string, body: string): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#171717">
      <h1 style="font-size:18px;margin-bottom:16px">${escapeHtml(subject)}</h1>
      <div style="line-height:1.6;font-size:15px">${bodyToHtml(body)}</div>
      <p style="font-size:12px;color:#737373;margin-top:32px;border-top:1px solid #e5e5e5;padding-top:16px">
        This announcement was sent from WSSO. You can also view it in the app under Announcements.
      </p>
    </div>
  `.trim()
}

/**
 * Sends an announcement email with all recipients in BCC so they cannot see each other.
 */
export async function sendAnnouncementEmail(
  params: AnnouncementEmailParams,
): Promise<AnnouncementEmailResult> {
  if (!brevoConfigured()) {
    return { sent: false, error: 'Brevo SMTP not configured' }
  }

  const emails = params.bcc.filter(Boolean)
  if (emails.length === 0) {
    return { sent: false, error: 'No recipient email addresses' }
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
      to:      from,
      bcc:     emails,
      subject: params.subject,
      html:    announcementHtml(params.subject, params.body),
    })
    return { sent: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Email send failed'
    return { sent: false, error: message }
  }
}
