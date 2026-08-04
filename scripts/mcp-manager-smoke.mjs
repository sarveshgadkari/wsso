/**
 * Manager-role MCP permission smoke test
 * node scripts/mcp-manager-smoke.mjs
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
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const MCP = 'http://localhost:3000/api/mcp/mcp'
const PASSWORD = 'McpSmokeTest!23456'
const stamp = Date.now()
const mgrEmail = `mcp.mgr.${stamp}@example.com`
const empEmail = `mcp.emp2.${stamp}@example.com`

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const anon = createClient(URL, ANON, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function mcp(method, params, token, id = 1) {
  const res = await fetch(MCP, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  })
  const text = await res.text()
  let body
  try {
    if (text.includes('data:')) {
      const lines = text.split(/\n/).filter((l) => l.startsWith('data:'))
      body = JSON.parse(lines.at(-1).replace(/^data:\s*/, ''))
    } else {
      body = JSON.parse(text)
    }
  } catch {
    body = { raw: text.slice(0, 300) }
  }
  return body
}

function txt(b) {
  return b?.result?.content?.[0]?.text || JSON.stringify(b?.error || b).slice(0, 220)
}
function ok(b) {
  return !!b?.result?.content && !b?.result?.isError
}

let mgrId = null
let empId = null
let failed = 0

function record(name, pass, detail = '') {
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + String(detail).slice(0, 180) : ''}`)
  if (!pass) failed += 1
}

try {
  const emp = await admin.auth.admin.createUser({
    email: empEmail,
    password: PASSWORD,
    email_confirm: true,
  })
  empId = emp.data.user.id
  await admin.from('profiles').upsert({
    id: empId,
    email: empEmail,
    full_name: 'MCP Emp2',
    role: 'employee',
    status: 'active',
  })

  const mgr = await admin.auth.admin.createUser({
    email: mgrEmail,
    password: PASSWORD,
    email_confirm: true,
  })
  mgrId = mgr.data.user.id
  await admin.from('profiles').upsert({
    id: mgrId,
    email: mgrEmail,
    full_name: 'MCP Mgr',
    role: 'manager',
    status: 'active',
  })

  const sess = await anon.auth.signInWithPassword({
    email: mgrEmail,
    password: PASSWORD,
  })
  const token = sess.data.session.access_token

  let r = await mcp(
    'tools/call',
    { name: 'employees_list', arguments: { limit: 10, offset: 0 } },
    token,
  )
  record('manager_employees_list', ok(r), txt(r))

  r = await mcp(
    'tools/call',
    {
      name: 'tactics_create',
      arguments: {
        title: 'MCP mgr smoke WO',
        assigned_to: empId,
        priority: 'medium',
      },
    },
    token,
  )
  record('manager_tactics_create', ok(r), txt(r))

  let tacticId = null
  try {
    tacticId = JSON.parse(txt(r)).id
  } catch {
    /* ignore */
  }

  if (tacticId) {
    // Creator-manager should NOT progress assigned -> in_progress (assignee-only)
    r = await mcp(
      'tools/call',
      {
        name: 'tactics_transition_status',
        arguments: { id: tacticId, target_status: 'in_progress' },
      },
      token,
    )
    const denied = r?.result?.isError === true || /cannot transition/i.test(txt(r))
    record('manager_cannot_progress_as_assignee', denied, txt(r))
    await admin.from('activity_logs').delete().eq('tactic_id', tacticId)
    await admin.from('tactics').delete().eq('id', tacticId)
  } else {
    record('manager_cannot_progress_as_assignee', false, 'no tactic id')
  }

  r = await mcp(
    'tools/call',
    { name: 'time_team_logs', arguments: { limit: 5, offset: 0 } },
    token,
  )
  record('manager_time_team_logs', ok(r), txt(r))
} catch (err) {
  record('fatal', false, err instanceof Error ? err.message : String(err))
} finally {
  if (mgrId) await admin.auth.admin.deleteUser(mgrId)
  if (empId) await admin.auth.admin.deleteUser(empId)
  console.log(failed ? `\nFailed: ${failed}` : '\nAll manager checks passed.')
  process.exit(failed ? 1 : 0)
}
