'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Bot, Check, Copy, RefreshCw, Shield } from 'lucide-react'

type ConnectionPayload = {
  mcpUrl: string
  accessToken: string
  tokenType: 'mcp_long_lived' | 'session'
  ttlDays: number | null
  expiresAt: number | null
  expiresInSeconds: number | null
  user: {
    id: string
    email: string | null
    fullName: string | null
    role: string | null
    employeeCode: string | null
  }
  clientConfig: {
    name: string
    url: string
    headers: { Authorization: string }
  }
  workforceCustomMcp: {
    serverId: string
    command: string
    args: string
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  }
}

function formatExpiry(expiresAt: number | null, expiresInSeconds: number | null, ttlDays: number | null) {
  if (ttlDays && expiresAt) {
    const days = Math.max(0, Math.ceil((expiresInSeconds ?? 0) / 86400))
    return `Long-lived token · ~${days} day(s) left · expires ${new Date(expiresAt * 1000).toLocaleDateString()}`
  }
  if (expiresInSeconds != null && expiresInSeconds < 3600) {
    return `Short session token · expires in ~${Math.max(1, Math.floor(expiresInSeconds / 60))} min — click New token`
  }
  if (expiresAt) return `Expires ${new Date(expiresAt * 1000).toLocaleString()}`
  return 'Active'
}

export function ConnectAiPanel() {
  const [data, setData] = useState<ConnectionPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [rotating, setRotating] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/mcp/connection', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not load connection')
      setData(json as ConnectionPayload)
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : 'Could not load connection')
    } finally {
      setLoading(false)
    }
  }, [])

  const rotate = useCallback(async () => {
    setRotating(true)
    setError(null)
    try {
      const res = await fetch('/api/mcp/connection', { method: 'POST', cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not create new token')
      setData(json as ConnectionPayload)
      setShowToken(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create new token')
    } finally {
      setRotating(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const flashCopied = (key: string) => {
    setCopied(key)
    window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000)
  }

  const onCopy = async (key: string, text: string) => {
    const ok = await copyText(text)
    if (ok) flashCopied(key)
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <section className="rounded-lg border border-primary-200 bg-primary-50/60 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-white p-2 text-primary-700 shadow-sm">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-neutral-900">
              Paste into Workforce 2.0 → Custom MCP
            </h3>
            <p className="mt-1 text-sm text-neutral-600">
              Use a <strong>30-day</strong> token (not the old 1-hour login). Copy the three
              fields below into Workforce, then click Add.
            </p>

            {data && (
              <div className="mt-4 space-y-3 rounded-lg border border-primary-100 bg-white p-4">
                <PasteRow
                  label="Server ID"
                  value={data.workforceCustomMcp.serverId}
                  copied={copied === 'sid'}
                  onCopy={() => void onCopy('sid', data.workforceCustomMcp.serverId)}
                />
                <PasteRow
                  label="Command"
                  value={data.workforceCustomMcp.command}
                  copied={copied === 'cmd'}
                  onCopy={() => void onCopy('cmd', data.workforceCustomMcp.command)}
                />
                <PasteRow
                  label="Args"
                  value={data.workforceCustomMcp.args}
                  copied={copied === 'args'}
                  onCopy={() => void onCopy('args', data.workforceCustomMcp.args)}
                  mono
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Your MCP token</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Lasts ~30 days. Only click <strong>New token</strong> if the old one leaked or stopped
              working — then paste Args into Workforce again.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
              <RefreshCw className="h-3.5 w-3.5" />
              Reload
            </Button>
            <Button type="button" size="sm" onClick={() => void rotate()} loading={rotating}>
              New token
            </Button>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {error}
          </p>
        )}

        {loading && !data && !error && (
          <p className="mt-4 text-sm text-neutral-500">Loading your connection…</p>
        )}

        {data && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
              <Shield className="h-3.5 w-3.5 text-primary-600" />
              <span>
                Connected as{' '}
                <strong className="text-neutral-800">
                  {data.user.fullName || data.user.email || 'User'}
                </strong>
                {data.user.role ? ` · ${data.user.role}` : ''}
                {data.user.employeeCode ? ` · ${data.user.employeeCode}` : ''}
              </span>
              <span className="text-neutral-400">·</span>
              <span>
                {formatExpiry(data.expiresAt, data.expiresInSeconds, data.ttlDays)}
              </span>
              {data.tokenType === 'session' && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                  Fallback short token — set SUPABASE_JWT_SECRET + run migration
                </span>
              )}
            </div>

            <Field
              label="MCP URL (if Workforce has URL mode)"
              value={data.mcpUrl}
              copied={copied === 'url'}
              onCopy={() => void onCopy('url', data.mcpUrl)}
            />

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Access token
                </label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary-700 hover:underline"
                  onClick={() => setShowToken((s) => !s)}
                >
                  {showToken ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  readOnly
                  className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-800"
                  type={showToken ? 'text' : 'password'}
                  value={data.accessToken}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void onCopy('token', data.accessToken)}
                >
                  {copied === 'token' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === 'token' ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <Field
              label="Full JSON (if Workforce accepts JSON paste)"
              value={JSON.stringify(data.clientConfig, null, 2)}
              multiline
              copied={copied === 'json'}
              onCopy={() => void onCopy('json', JSON.stringify(data.clientConfig, null, 2))}
            />
          </div>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5">
        <h3 className="text-sm font-semibold text-neutral-900">Steps</h3>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-neutral-700">
          <li>Open Workforce 2.0 → Custom MCP.</li>
          <li>Paste <strong>Server ID</strong>, <strong>Command</strong>, and <strong>Args</strong> from the green box above.</li>
          <li>Click Add / Save.</li>
          <li>Ask: “What are my open work orders?”</li>
          <li>Only if it fails after ~30 days (or you clicked New token): paste Args again.</li>
        </ol>
      </section>
    </div>
  )
}

function PasteRow({
  label,
  value,
  onCopy,
  copied,
  mono,
}: {
  label: string
  value: string
  onCopy: () => void
  copied: boolean
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <code
        className={`min-w-0 flex-1 truncate rounded bg-neutral-100 px-2 py-1.5 text-xs text-neutral-800 ${mono ? 'font-mono' : ''}`}
        title={value}
      >
        {value}
      </code>
      <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={onCopy}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}

function Field({
  label,
  value,
  onCopy,
  copied,
  multiline,
}: {
  label: string
  value: string
  onCopy: () => void
  copied: boolean
  multiline?: boolean
}) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</label>
      <div className="mt-1.5 flex gap-2">
        {multiline ? (
          <textarea
            readOnly
            rows={5}
            className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-800"
            value={value}
          />
        ) : (
          <input
            readOnly
            className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-800"
            value={value}
          />
        )}
        <Button type="button" variant="secondary" size="sm" className="shrink-0 self-start" onClick={onCopy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}
