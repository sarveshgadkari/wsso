import type { LeadStatus } from '@/lib/types'

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new:       'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  converted: 'Converted',
  lost:      'Lost',
}

export const LEAD_STATUS_VARIANT: Record<LeadStatus, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'> = {
  new:       'info',
  contacted: 'warning',
  qualified: 'purple',
  converted: 'success',
  lost:      'danger',
}

export const LEAD_CSV_TEMPLATE =
  'first_name,last_name,email,company,inquiry_type,message\n' +
  'Jane,Doe,jane@acme.com,Acme Inc,Partnership,Interested in WSSO for our team\n'

const HEADER_ALIASES: Record<string, string> = {
  first_name: 'first_name',
  firstname: 'first_name',
  'first name': 'first_name',
  last_name: 'last_name',
  lastname: 'last_name',
  'last name': 'last_name',
  email: 'email',
  'e-mail': 'email',
  company: 'company',
  inquiry_type: 'inquiry_type',
  inquirytype: 'inquiry_type',
  'inquiry type': 'inquiry_type',
  enquiry_type: 'inquiry_type',
  message: 'message',
  notes: 'message',
  source: 'source',
  status: 'status',
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur.trim())
  return out
}

export function parseLeadCsv(text: string): {
  rows: Array<{
    first_name: string
    last_name: string
    email: string
    company?: string
    inquiry_type?: string
    message?: string
    source?: string
  }>
  error?: string
} {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return { rows: [], error: 'CSV needs a header row and at least one lead.' }

  const headers = parseCsvLine(lines[0]).map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? h.trim().toLowerCase())
  const first = headers.indexOf('first_name')
  const last = headers.indexOf('last_name')
  const email = headers.indexOf('email')
  if (first < 0 || last < 0 || email < 0) {
    return { rows: [], error: 'CSV must include first_name, last_name, and email columns.' }
  }

  const col = (name: string) => headers.indexOf(name)
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const pick = (i: number) => (i >= 0 ? (cells[i] ?? '').trim() : '')
    return {
      first_name: pick(first),
      last_name: pick(last),
      email: pick(email),
      company: pick(col('company')) || undefined,
      inquiry_type: pick(col('inquiry_type')) || undefined,
      message: pick(col('message')) || undefined,
      source: pick(col('source')) || undefined,
    }
  })

  return { rows }
}
