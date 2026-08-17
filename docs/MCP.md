# WSSO MCP — Deploy & Share Guide

This document explains how to **deploy** the WSSO MCP server and how others can **connect it** to Cursor, Claude Desktop, or any MCP-compatible AI tool.

---

## What you are sharing

WSSO MCP is an HTTP API that lets AI agents call WSSO tools (work orders, time, leave, training, etc.) using an employee login token.

| Item | Value |
|---|---|
| Production app | https://wsso.vercel.app |
| MCP endpoint | `https://wsso.vercel.app/api/mcp/mcp` |
| Auth | `Authorization: Bearer <supabase_access_token>` |
| Access model | Same as the web app — Supabase RLS + role rules |
| Transport | Streamable HTTP (MCP) |
| Hosting | Vercel only |

After connecting, the AI can only see/do what **that employee account** is allowed to see/do.

---

## 1. Deploy (production — Vercel)

MCP is part of the same Next.js app on Vercel at [https://wsso.vercel.app](https://wsso.vercel.app/). Deploying WSSO also deploys MCP.

### Redeploy steps

1. Push your latest code to GitHub (including `src/mcp/` and `src/app/api/mcp/`).
2. In [Vercel](https://vercel.com), open the existing WSSO project and deploy (or let Git push auto-deploy).
3. Confirm these environment variables are set in Vercel → Project → Settings → Environment Variables:

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Same as the web app |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Same as the web app |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only; never expose to browser |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://wsso.vercel.app` |

4. After deploy, confirm MCP is live:

```bash
curl -i https://wsso.vercel.app/api/mcp/mcp
```

Expected without a token: **401 Unauthorized** (that means the route is up and auth is required).

### Local development only

```bash
npm install
npm run build
npm run start
```

Local MCP URL (dev only):

```text
http://localhost:3000/api/mcp/mcp
```

### Smoke test against production

```bash
# Windows PowerShell
$env:MCP_URL="https://wsso.vercel.app/api/mcp/mcp"
npm run test:mcp
npm run test:mcp:manager
```

```bash
# macOS / Linux
MCP_URL=https://wsso.vercel.app/api/mcp/mcp npm run test:mcp
MCP_URL=https://wsso.vercel.app/api/mcp/mcp npm run test:mcp:manager
```

---

## 2. How users get an access token

### Easy way for everyone (recommended)

1. Log in to WSSO in the browser.
2. Open **Connect AI** in the sidebar (`/connect-ai`).
3. Click **Copy** on MCP URL, Access token, or Full JSON config.
4. Paste into Workforce 2.0 / Cursor / your MCP client.

No DevTools required. Click **Refresh** on that page when the token expires.

### Developer way (browser DevTools)

1. Log in to WSSO in the browser.
2. Open DevTools → Application / Storage → find the Supabase auth session,
   **or** run in the browser console on the WSSO site:

```js
const key = Object.keys(localStorage).find(k => k.includes('auth-token'))
JSON.parse(localStorage.getItem(key)).access_token
```

3. Copy the `access_token` value.
4. Paste it into the MCP client config as the Bearer token.

> Tokens expire. When tools start failing with Unauthorized, log in again and refresh the token.

### Safer long-term options (for teams)

- Issue short-lived tokens via your existing auth flow
- Build a small “Connect AI / MCP” page in WSSO that shows a copyable token / connection instructions
- Prefer **never** committing tokens into git

---

## 3. Share with others — client setup

Give integrators three things:

1. **MCP URL** — `https://wsso.vercel.app/api/mcp/mcp`
2. **Auth header** — `Authorization: Bearer <their_token>`
3. This doc (or the short snippet below)

### Cursor

Create or edit `.cursor/mcp.json` in the project (or global Cursor MCP settings):

```json
{
  "mcpServers": {
    "wsso": {
      "url": "https://wsso.vercel.app/api/mcp/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SUPABASE_ACCESS_TOKEN"
      }
    }
  }
}
```

Local testing only:

```json
{
  "mcpServers": {
    "wsso": {
      "url": "http://localhost:3000/api/mcp/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SUPABASE_ACCESS_TOKEN"
      }
    }
  }
}
```

Example file in repo: [`.cursor/mcp.json.example`](../.cursor/mcp.json.example)

Then restart Cursor / reload MCP servers. You should see tools like `employees_me`, `tactics_list`, `time_clock_in`.

### Claude Desktop

If your Claude Desktop build supports remote MCP HTTP servers, add a similar entry in the MCP config (URL + Bearer header).

If it only supports stdio, use a bridge:

```json
{
  "mcpServers": {
    "wsso": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://wsso.vercel.app/api/mcp/mcp",
        "--header",
        "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN"
      ]
    }
  }
}
```

### Any other MCP client / custom agent

Point the client at:

```http
POST https://wsso.vercel.app/api/mcp/mcp
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json, text/event-stream
```

The server speaks standard MCP over Streamable HTTP (`initialize`, `tools/list`, `tools/call`, etc.).

---

## 4. What integrators can do (quick map)

| Need | Example tools |
|---|---|
| Who am I? | `employees_me` |
| My work orders | `tactics_list`, `tactics_get`, `tactics_transition_status` |
| Time | `time_clock_in`, `time_clock_out`, `time_my_logs` |
| Leave | `leave_request`, `leave_list` |
| Training | `training_list_modules`, `training_submit_quiz` |
| Manager team views | `time_team_logs`, `leave_review`, `tactics_create` |

Built-in prompts (optional):

- `weekly_review`
- `project_status`
- `onboard_employee_checklist`

Resources:

- `wsso://roles`
- `wsso://statuses`
- `wsso://org-hierarchy`

---

## 5. Security checklist before sharing

- [ ] MCP URL is HTTPS in production
- [ ] Users use **their own** tokens (never a shared admin token)
- [ ] Service role key stays only on the server / Vercel env
- [ ] Confirm 401 without token
- [ ] Confirm an employee token cannot create/approve work they should not
- [ ] Do not put tokens in screenshots, Slack, or git

Role rules already enforced:

- Employee → own data + assigned work only
- Manager → team scope; cannot approve own work / another manager’s work
- Admin → full access (same as web app)

---

## 6. Short message you can send to a teammate

Copy/paste:

```text
WSSO MCP is available for AI tools (Cursor / Claude / custom agents).

App:
https://wsso.vercel.app

MCP URL:
https://wsso.vercel.app/api/mcp/mcp

Auth:
Authorization: Bearer <your WSSO Supabase access_token>

1. Log in to WSSO at https://wsso.vercel.app
2. Copy your access_token from the browser session
3. Add the MCP server config in Cursor (see docs/MCP.md)
4. Restart Cursor and try: “Show my profile using employees_me”

The AI will only access what your account can already see in WSSO.
```

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| `{"error":"invalid_token","error_description":"No authorization provided"}` | **Missing Bearer token.** Do not open the MCP URL in a browser. Put a real Supabase `access_token` in the client config `Authorization` header. |
| Still `invalid_token` after adding token | You left the placeholder `REPLACE_WITH_SUPABASE_ACCESS_TOKEN`, or the token expired — log in again and copy a fresh `access_token`. |
| `fetch failed` in smoke tests | Start app first: `npm run dev` (or use the Vercel URL with `MCP_URL`) |
| `401 Unauthorized` | Token missing/expired — log in again and refresh token |
| Tools missing in Cursor | Check MCP config URL is exactly `https://wsso.vercel.app/api/mcp/mcp`, reload MCP servers |
| Employee can see too little | Expected — RLS. Use a manager/admin account if needed |
| Deployed but 404 | Confirm latest deploy includes `src/app/api/mcp/[transport]/route.ts` |

### Fix this error in Cursor (step by step)

1. Log in at [https://wsso.vercel.app](https://wsso.vercel.app/)
2. Press `F12` → Console → paste:

```js
const key = Object.keys(localStorage).find(k => k.includes('auth-token'))
copy(JSON.parse(localStorage.getItem(key)).access_token)
```

3. Create/edit `.cursor/mcp.json` (project or user MCP settings):

```json
{
  "mcpServers": {
    "wsso": {
      "url": "https://wsso.vercel.app/api/mcp/mcp",
      "headers": {
        "Authorization": "Bearer PASTE_TOKEN_HERE"
      }
    }
  }
}
```

4. Replace `PASTE_TOKEN_HERE` with the copied token (keep the word `Bearer` and a space).
5. Restart Cursor / reload MCP.
6. Ask: “Use employees_me and tell me who I am.”

> Opening `https://wsso.vercel.app/api/mcp/mcp` in Chrome will always show `No authorization provided` — that is normal. MCP clients must send the header.

---

## 8. Repo reference

| Path | Purpose |
|---|---|
| `src/app/api/mcp/[transport]/route.ts` | MCP HTTP entry |
| `src/mcp/` | Auth + tools + resources + prompts |
| `scripts/mcp-smoke-test.mjs` | Employee smoke tests |
| `scripts/mcp-manager-smoke.mjs` | Manager permission smoke tests |
| `.cursor/mcp.json.example` | Cursor config template |
