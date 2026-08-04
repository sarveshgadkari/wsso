/**
 * MCP smoke test — run with: node scripts/mcp-smoke-test.mjs
 * Creates a temporary employee, gets a JWT, exercises MCP tools one by one.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const MCP = process.env.MCP_URL || 'http://localhost:3000/api/mcp/mcp'
const EMAIL = `mcp.smoke.${Date.now()}@example.com`
const PASSWORD = 'McpSmokeTest!23456'

if (!URL || !ANON || !SERVICE) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const anon = createClient(URL, ANON, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []

function record(name, ok, detail = '') {
  results.push({ name, ok, detail: String(detail).slice(0, 240) })
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`[${mark}] ${name}${detail ? ' — ' + String(detail).slice(0, 160) : ''}`)
}

async function mcp(method, params = {}, token, id = 1) {
  const res = await fetch(MCP, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  })
  const text = await res.text()
  let body
  try {
    // Streamable HTTP may return SSE; try parse last JSON line / whole body
    if (text.includes('data:')) {
      const lines = text.split(/\n/).filter((l) => l.startsWith('data:'))
      const last = lines[lines.length - 1]?.replace(/^data:\s*/, '') || '{}'
      body = JSON.parse(last)
    } else {
      body = JSON.parse(text)
    }
  } catch {
    body = { parseError: true, status: res.status, text: text.slice(0, 400) }
  }
  return { status: res.status, body, raw: text.slice(0, 400) }
}

async function callTool(token, name, args = {}) {
  return mcp(
    'tools/call',
    { name, arguments: args },
    token,
    Math.floor(Math.random() * 100000),
  )
}

function toolText(body) {
  const c = body?.result?.content?.[0]?.text
  if (c) return c
  if (body?.error) return JSON.stringify(body.error)
  return JSON.stringify(body).slice(0, 200)
}

function toolOk(body) {
  if (body?.result?.isError) return false
  if (body?.error) return false
  if (body?.result?.content) return true
  return false
}

let userId = null

try {
  // Quick connectivity check first
  try {
    await fetch(MCP, { method: 'GET' })
  } catch {
    record(
      'fatal',
      false,
      `Cannot reach ${MCP}. Start the app first with: npm run dev`,
    )
    console.log('\n======== SUMMARY ========')
    console.log('Total: 1  Pass: 0  Fail: 1')
    console.log(`Failed:\n - fatal: Cannot reach ${MCP}. Start the app first with: npm run dev`)
    process.exit(1)
  }

  // ── 0) Route reachable without auth ──────────────────────────────────────
  {
    const r = await mcp('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'wsso-smoke', version: '0.1.0' },
    })
    const unauthorized = r.status === 401 || r.body?.error
    record('auth_required_without_token', unauthorized, `status=${r.status}`)
  }

  // ── 1) Create temp employee ──────────────────────────────────────────────
  {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'MCP Smoke Tester' },
    })
    if (error) throw new Error('createUser: ' + error.message)
    userId = data.user.id

    // Ensure profile exists / is active employee
    const { error: upErr } = await admin.from('profiles').upsert({
      id: userId,
      email: EMAIL,
      full_name: 'MCP Smoke Tester',
      role: 'employee',
      status: 'active',
      employee_code: `MCP${String(Date.now()).slice(-5)}`,
    })
    // Some schemas may not have email on profiles — fallback update role/status only
    if (upErr) {
      const { error: up2 } = await admin
        .from('profiles')
        .update({ role: 'employee', status: 'active', full_name: 'MCP Smoke Tester' })
        .eq('id', userId)
      if (up2) {
        // Profile may be auto-created by trigger — try select
        const { data: prof, error: pErr } = await admin
          .from('profiles')
          .select('id, role, status')
          .eq('id', userId)
          .maybeSingle()
        if (pErr || !prof) throw new Error('profile setup failed: ' + (upErr.message || pErr?.message))
        await admin
          .from('profiles')
          .update({ role: 'employee', status: 'active', full_name: 'MCP Smoke Tester' })
          .eq('id', userId)
      }
    }
    record('create_temp_employee', true, userId)
  }

  // ── 2) Sign in for JWT ───────────────────────────────────────────────────
  let token = null
  {
    const { data, error } = await anon.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    })
    if (error || !data.session?.access_token) {
      record('sign_in_get_jwt', false, error?.message || 'no token')
      throw new Error('Cannot continue without JWT')
    }
    token = data.session.access_token
    record('sign_in_get_jwt', true, 'token length ' + token.length)
  }

  // ── 3) Initialize ────────────────────────────────────────────────────────
  {
    const r = await mcp(
      'initialize',
      {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'wsso-smoke', version: '0.1.0' },
      },
      token,
    )
    const ok =
      r.status < 400 &&
      (r.body?.result?.serverInfo || r.body?.result?.protocolVersion || r.body?.result)
    record('mcp_initialize', !!ok, toolText(r.body) || `status=${r.status}`)
  }

  // ── 4) tools/list ────────────────────────────────────────────────────────
  let toolNames = []
  {
    const r = await mcp('tools/list', {}, token, 2)
    toolNames = (r.body?.result?.tools || []).map((t) => t.name)
    record('tools_list', toolNames.length > 0, `${toolNames.length} tools`)
  }

  // ── 5) Call tools one by one (read-safe first) ───────────────────────────
  const readCalls = [
    ['employees_me', {}],
    ['employees_list', { limit: 5, offset: 0 }],
    ['companies_list', { limit: 5, offset: 0 }],
    ['teams_list', { limit: 5, offset: 0 }],
    ['org_hierarchy', {}],
    ['projects_list', { limit: 5, offset: 0 }],
    ['clients_list', { limit: 5, offset: 0 }],
    ['tactics_list', { limit: 5, offset: 0 }],
    ['time_active_session', {}],
    ['time_my_logs', { limit: 5, offset: 0 }],
    ['leave_list', { limit: 5, offset: 0 }],
    ['leads_list', { limit: 5, offset: 0 }],
    ['documents_list', { limit: 5, offset: 0 }],
    ['training_list_modules', {}],
    ['training_get_progress', {}],
    ['reports_work_orders', {}],
    ['notifications_list', { limit: 5, offset: 0, unread_only: false }],
    ['announcements_list', { limit: 5, offset: 0 }],
  ]

  for (const [name, args] of readCalls) {
    if (toolNames.length && !toolNames.includes(name)) {
      record(name, false, 'tool not registered')
      continue
    }
    const r = await callTool(token, name, args)
    record(name, toolOk(r.body), toolText(r.body))
  }

  // ── 6) training_get_module (real module if present) ──────────────────────
  {
    const list = await callTool(token, 'training_list_modules', {})
    let moduleId = null
    try {
      moduleId = JSON.parse(toolText(list.body))?.modules?.[0]?.id ?? null
    } catch { /* ignore */ }
    if (moduleId) {
      const r = await callTool(token, 'training_get_module', { id: moduleId })
      const text = toolText(r.body)
      const leaked = /"is_correct"\s*:/.test(text)
      record('training_get_module', toolOk(r.body) && !leaked, leaked ? 'ANSWER LEAK' : text)
    } else {
      record('training_get_module', true, 'skipped — no modules')
    }
  }

  // ── 7) clock in / out ────────────────────────────────────────────────────
  {
    const cin = await callTool(token, 'time_clock_in', { note: 'mcp smoke in' })
    record('time_clock_in', toolOk(cin.body), toolText(cin.body))
    const active = await callTool(token, 'time_active_session', {})
    let isActive = false
    try {
      isActive = !!JSON.parse(toolText(active.body))?.active
    } catch { /* ignore */ }
    record('time_active_after_clock_in', isActive, toolText(active.body))
    await new Promise((r) => setTimeout(r, 1200))
    const cout = await callTool(token, 'time_clock_out', { note: 'mcp smoke out' })
    record('time_clock_out', toolOk(cout.body), toolText(cout.body))
  }

  // ── 8) leave request (write) ─────────────────────────────────────────────
  {
    const start = new Date()
    start.setDate(start.getDate() + 30)
    const y = start.toISOString().slice(0, 10)
    const r = await callTool(token, 'leave_request', {
      start_date: y,
      end_date: y,
      half_day: false,
      reason: 'MCP smoke test leave — safe to ignore/cancel',
    })
    record('leave_request', toolOk(r.body), toolText(r.body))
  }

  // ── 9) permission denials for employee role ──────────────────────────────
  {
    const create = await callTool(token, 'tactics_create', {
      title: 'Should fail',
      assigned_to: userId,
      priority: 'low',
    })
    // tool returns isError content for thrown Unauthorized
    const denied =
      create.body?.result?.isError === true ||
      /unauthorized/i.test(toolText(create.body))
    record('employee_cannot_create_tactic', denied, toolText(create.body))
  }
  {
    const team = await callTool(token, 'time_team_logs', { limit: 5, offset: 0 })
    const denied =
      team.body?.result?.isError === true ||
      /unauthorized/i.test(toolText(team.body))
    record('employee_cannot_view_team_time', denied, toolText(team.body))
  }
  {
    const review = await callTool(token, 'leave_review', {
      id: '00000000-0000-4000-8000-000000000001',
      decision: 'approved',
    })
    const denied =
      review.body?.result?.isError === true ||
      /access denied|not found|unauthorized/i.test(toolText(review.body))
    record('employee_cannot_review_leave', denied, toolText(review.body))
  }

  // ── 10) resources/list ───────────────────────────────────────────────────
  {
    const r = await mcp('resources/list', {}, token, 3)
    const count = r.body?.result?.resources?.length ?? 0
    record('resources_list', count > 0, count > 0 ? `${count} resources` : toolText(r.body))
  }

  // ── 11) prompts/list ─────────────────────────────────────────────────────
  {
    const r = await mcp('prompts/list', {}, token, 4)
    const count = r.body?.result?.prompts?.length ?? 0
    record('prompts_list', count > 0, count > 0 ? `${count} prompts` : toolText(r.body))
  }

  // cleanup leave rows for temp user
  await admin.from('leave_requests').delete().eq('employee_id', userId)
  await admin.from('time_logs').delete().eq('employee_id', userId)
  await admin.from('training_progress').delete().eq('employee_id', userId)
} catch (err) {
  record('fatal', false, err instanceof Error ? err.message : String(err))
} finally {
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId)
    record('cleanup_temp_user', !error, error?.message || userId)
  }
}

const failed = results.filter((r) => !r.ok)
console.log('\n======== SUMMARY ========')
console.log(`Total: ${results.length}  Pass: ${results.length - failed.length}  Fail: ${failed.length}`)
if (failed.length) {
  console.log('Failed:')
  for (const f of failed) console.log(` - ${f.name}: ${f.detail}`)
  process.exit(1)
}
console.log('All checks passed.')
process.exit(0)
