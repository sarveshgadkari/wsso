'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Bot, Check, Copy, ExternalLink, RefreshCw, Shield } from 'lucide-react'

type ConnectionPayload = {
  mcpUrl: string
  accessToken: string
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

function formatExpiry(expiresAt: number | null, expiresInSeconds: number | null) {
  if (!expiresAt && expiresInSeconds == null) return 'Unknown'
  if (expiresInSeconds != null && expiresInSeconds < 60) return 'Expires in under 1 minute — refresh'
  if (expiresInSeconds != null && expiresInSeconds < 3600) {
    const m = Math.floor(expiresInSeconds / 60)
    return `Expires in ~${m} min`
  }
  if (expiresAt) {
    return `Expires ${new Date(expiresAt * 1000).toLocaleString()}`
  }
  return 'Active'
}

export function ConnectAiPanel() {
  const [data, setData] = useState<ConnectionPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
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
      {/* How it connects */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-primary-50 p-2 text-primary-700">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">
              How local Workforce 2.0 connects
            </h3>
            <p className="mt-1 text-sm text-neutral-600 leading-relaxed">
              Workforce 2.0 can stay installed on your computer. It does <strong>not</strong> need
              WSSO installed locally. It calls our cloud MCP over the internet:
            </p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-neutral-700">
              <li>You stay logged in to WSSO here and copy the connection below.</li>
              <li>
                In Workforce 2.0 open <strong>Integrations → WSSO MCP</strong> (or Custom MCP) and
                paste the MCP URL + token (or the JSON config).
              </li>
              <li>
                Workforce 2.0 stores that on your device and sends requests to{' '}
                <code className="rounded bg-neutral-100 px-1 text-xs">wsso.vercel.app</code>.
              </li>
              <li>
                WSSO checks your login and only allows what <em>you</em> can see (same as this
                dashboard).
              </li>
            </ol>
            <pre className="mt-4 overflow-x-auto rounded-md bg-neutral-900 p-3 text-[11px] leading-relaxed text-neutral-100">
{`Workforce 2.0 (on your PC)
        │  HTTPS + your token
        ▼
https://wsso.vercel.app/api/mcp/mcp
        │
        ▼
Your WSSO permissions → your data only`}
            </pre>
          </div>
        </div>
      </section>

      {/* Connection details */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Your connection</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              One-click copy — no DevTools. Token expires; click Refresh when AI tools stop working.
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
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
              <span>{formatExpiry(data.expiresAt, data.expiresInSeconds)}</span>
            </div>

            {/* MCP URL */}
            <Field
              label="1. MCP URL"
              hint="Paste this in Workforce 2.0 as the server URL"
              value={data.mcpUrl}
              copied={copied === 'url'}
              onCopy={() => void onCopy('url', data.mcpUrl)}
            />

            {/* Token */}
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  2. Access token
                </label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary-700 hover:underline"
                  onClick={() => setShowToken((s) => !s)}
                >
                  {showToken ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="mb-1.5 text-xs text-neutral-500">
                In Workforce 2.0 use header{' '}
                <code className="rounded bg-neutral-100 px-1">Authorization</code> ={' '}
                <code className="rounded bg-neutral-100 px-1">Bearer &lt;token&gt;</code>
              </p>
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

            {/* Full JSON */}
            <Field
              label="3. Full config (JSON) — easiest if Workforce 2.0 accepts paste"
              hint="One paste for URL + Authorization header"
              value={JSON.stringify(data.clientConfig, null, 2)}
              multiline
              copied={copied === 'json'}
              onCopy={() => void onCopy('json', JSON.stringify(data.clientConfig, null, 2))}
            />

            {/* Bearer line for custom MCP command args */}
            <Field
              label="4. Optional — stdio / mcp-remote Args (advanced)"
              hint="Only if the app asks for Command + Args instead of a URL"
              value={`-y mcp-remote ${data.mcpUrl} --header Authorization: Bearer ${data.accessToken}`}
              copied={copied === 'args'}
              onCopy={() =>
                void onCopy(
                  'args',
                  `-y mcp-remote ${data.mcpUrl} --header Authorization: Bearer ${data.accessToken}`,
                )
              }
            />
          </div>
        )}
      </section>

      {/* Steps for Workforce 2.0 */}
      <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5">
        <h3 className="text-sm font-semibold text-neutral-900">In Workforce 2.0 (on your PC)</h3>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-neutral-700">
          <li>Open Workforce 2.0 → Integrations / Custom MCP.</li>
          <li>
            Prefer <strong>URL / HTTP</strong> mode if available — paste <strong>MCP URL</strong> +
            Bearer token (steps 1–2 above).
          </li>
          <li>
            If it only has Server ID / Command / Args: Server ID <code className="text-xs">wsso</code>,
            Command <code className="text-xs">npx</code>, Args = copy from step 4.
          </li>
          <li>Save. Ask the agent something like “What are my open work orders?”</li>
        </ol>
        <p className="mt-3 text-xs text-neutral-500">
          Your PC only stores the connection. All workforce data stays in WSSO cloud and follows your
          role permissions.
        </p>
        <a
          href="https://wsso.vercel.app"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Open WSSO app <ExternalLink className="h-3 w-3" />
        </a>
      </section>
    </div>
  )
}

function Field({
  label,
  hint,
  value,
  onCopy,
  copied,
  multiline,
}: {
  label: string
  hint?: string
  value: string
  onCopy: () => void
  copied: boolean
  multiline?: boolean
}) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</label>
      {hint && <p className="mb-1.5 mt-0.5 text-xs text-neutral-500">{hint}</p>}
      <div className="flex gap-2">
        {multiline ? (
          <textarea
            readOnly
            rows={6}
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
