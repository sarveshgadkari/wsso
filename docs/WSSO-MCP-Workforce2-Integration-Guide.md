# WSSO MCP Integration Guide  
## For Workforce 2.0 (External AI Agent Platform)

**Document type:** Partner integration specification  
**Version:** 1.0  
**Date:** August 2026  
**Prepared for:** Workforce 2.0 engineering / product team  
**Prepared by:** WSSO team  

---

## 1. Purpose

This document explains how **Workforce 2.0** can integrate the **WSSO MCP server** into their AI agent dashboard so that Workforce 2.0 agents can securely read and act on WSSO workforce data.

WSSO owns and hosts the MCP server.  
Workforce 2.0 only needs to **connect** to it as an MCP client.

---

## 2. What you are integrating

| Item | Value |
|---|---|
| Product | WSSO (Workforce / employee operations platform) |
| Protocol | [Model Context Protocol (MCP)](https://modelcontextprotocol.io) |
| Transport | Streamable HTTP |
| Production app | https://wsso.vercel.app |
| MCP base URL | **https://wsso.vercel.app/api/mcp/mcp** |
| Server name | `wsso-mcp` |
| Server version | `0.1.0` |
| Auth | Bearer token (WSSO user Supabase access token) |
| Hosting | Vercel |

After a user connects their WSSO account, the Workforce 2.0 agent can only access data that **that same user** is allowed to see inside WSSO (role + Row Level Security).

---

## 3. Integration overview (for your dashboard)

Recommended UX in Workforce 2.0:

1. User opens **Integrations → WSSO MCP**
2. User signs in to WSSO (or pastes a WSSO access token)
3. Workforce 2.0 stores the token securely (per user)
4. Workforce 2.0 MCP client connects to `https://wsso.vercel.app/api/mcp/mcp`
5. Agent discovers tools via `tools/list`
6. Agent calls tools via `tools/call` with the user’s Bearer token on every request

```
Workforce 2.0 Dashboard / AI Agent
        │
        │  HTTPS + Authorization: Bearer <wsso_access_token>
        ▼
https://wsso.vercel.app/api/mcp/mcp
        │
        ▼
WSSO Auth (validate JWT) → WSSO tools → Supabase RLS → PostgreSQL
```

---

## 4. Connection details (copy into your dashboard config)

### 4.1 Required connection fields

| Field | Value |
|---|---|
| Display name | WSSO |
| MCP URL | `https://wsso.vercel.app/api/mcp/mcp` |
| Auth type | Bearer / Header |
| Header name | `Authorization` |
| Header value | `Bearer <ACCESS_TOKEN>` |
| Methods to support | `GET`, `POST`, `DELETE` |
| Content-Type | `application/json` |
| Accept | `application/json, text/event-stream` |

### 4.2 Example client config (JSON)

```json
{
  "name": "wsso",
  "url": "https://wsso.vercel.app/api/mcp/mcp",
  "headers": {
    "Authorization": "Bearer <WSSO_USER_ACCESS_TOKEN>"
  }
}
```

### 4.3 Health / connectivity check

Request without token:

```http
GET https://wsso.vercel.app/api/mcp/mcp
```

Expected response:

```http
HTTP/1.1 401 Unauthorized
```

```json
{
  "error": "invalid_token",
  "error_description": "No authorization provided"
}
```

This confirms the MCP route is live and auth is required.

---

## 5. Authentication (critical)

### 5.1 Token type

Every MCP request must include a valid **WSSO user access token** (Supabase Auth JWT for that employee/manager/admin).

```http
Authorization: Bearer eyJhbGciOi...
```

### 5.2 How Workforce 2.0 should obtain the token

Choose one approach:

#### Option A — User pastes token (fastest to ship)
1. User logs into https://wsso.vercel.app
2. User copies access token from browser session
3. User pastes token into Workforce 2.0 “Connect WSSO” form

Browser console helper (for testing):

```js
const key = Object.keys(localStorage).find(k => k.includes('auth-token'))
copy(JSON.parse(localStorage.getItem(key)).access_token)
```

#### Option B — Guided login / OAuth-style flow (recommended later)
Workforce 2.0 redirects user to WSSO login, then receives a short-lived token/callback.  
This can be designed jointly in a follow-up.

### 5.3 Token rules

- Token is **per user** (never share one company-wide admin token across all agents)
- Token expires; refresh or ask user to reconnect when calls return 401
- Store tokens encrypted at rest in Workforce 2.0
- Never log full tokens
- Inactive WSSO accounts are rejected by MCP

### 5.4 Auth failure responses

| Situation | Typical result |
|---|---|
| No Authorization header | `401` + `invalid_token` / `No authorization provided` |
| Expired / invalid JWT | `401` Unauthorized |
| Inactive employee | Auth rejected |

---

## 6. MCP protocol usage

Workforce 2.0 should implement a standard MCP HTTP client.

### 6.1 Initialize

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "workforce-2.0",
      "version": "1.0.0"
    }
  }
}
```

### 6.2 List tools

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

### 6.3 Call a tool

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "employees_me",
    "arguments": {}
  }
}
```

### 6.4 Example successful tool result shape

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{ ...json payload... }"
      }
    ]
  }
}
```

Tool business errors are usually returned as:

```json
{
  "result": {
    "isError": true,
    "content": [
      { "type": "text", "text": "Error: Unauthorized: ..." }
    ]
  }
}
```

---

## 7. Security & permission model

### 7.1 Core rule

**The AI agent inherits the connected WSSO user’s permissions.**  
There is no privilege escalation through MCP.

### 7.2 Roles

| Role | What the agent can generally do |
|---|---|
| `employee` | Own profile, own time, own leave, assigned work orders, published training |
| `manager` | Team-scoped data + create/assign work orders; cannot approve own work or another manager’s work |
| `director` | Broad read access |
| `admin` | Full access (same as WSSO admin) |

### 7.3 Work-order status rules (important)

Status flow:

`assigned → in_progress → review → done → archived`

Rules enforced by MCP:

- Only the **assignee** progresses work through assigned / in_progress / review
- Only the **creating manager/admin** can approve (`review → done`) or send back (`review → in_progress`)
- Manager cannot approve their **own** work
- Manager cannot act on **another manager’s** work orders
- Employee cannot approve work

---

## 8. Complete tool catalog

Common pagination args (where listed):

- `limit` (number, default 25, max 100)
- `offset` (number, default 0)

Date format: `YYYY-MM-DD`  
IDs: UUID strings

### 8.1 Employees

| Tool | Description | Key inputs | Who |
|---|---|---|---|
| `employees_me` | Current connected profile | none | all |
| `employees_list` | List visible employees | `role?`, `status?`, `search?`, pagination | RLS |
| `employees_get` | Get one employee | `id` | RLS |

### 8.2 Organization

| Tool | Description | Key inputs | Who |
|---|---|---|---|
| `companies_list` | List companies | pagination | RLS |
| `companies_get` | Get company | `id` | RLS |
| `teams_list` | List teams | `company_id?`, pagination | RLS |
| `teams_get` | Get team | `id` | RLS |
| `org_hierarchy` | Companies + teams summary | none | RLS |

### 8.3 Work orders (tactics)

| Tool | Description | Key inputs | Who |
|---|---|---|---|
| `tactics_list` | List work orders | `status?`, `priority?`, `assigned_to?`, `project_id?`, pagination | RLS |
| `tactics_get` | Get work order + activity + allowed next statuses | `id` | RLS |
| `tactics_create` | Create work order | `title`, `assigned_to`, `priority`, optional fields | admin/manager |
| `tactics_update` | Update work order | `id` + fields | admin/manager |
| `tactics_transition_status` | Move status | `id`, `target_status`, `comment?`, `work_notes?` | role rules |
| `tactics_log_hours` | Log hours | `id`, `hours`, `notes?` | permitted users |
| `tactics_submit_work_update` | Add progress note | `id`, `notes` | assignee/allowed |
| `tactics_delete` | Delete work order | `id` | creator or admin |

`priority`: `low | medium | high | critical`  
`target_status`: `assigned | in_progress | review | done | archived`

### 8.4 Time tracking

| Tool | Description | Key inputs | Who |
|---|---|---|---|
| `time_clock_in` | Start today’s session | `note?` | self |
| `time_clock_out` | End open session | `note?` | self |
| `time_active_session` | Is user clocked in? | none | self |
| `time_my_logs` | Own time logs | `start_date?`, `end_date?`, pagination | self |
| `time_team_logs` | Team time logs | `employee_id?`, date range, pagination | manager/admin/director |
| `time_force_clock_out` | Force close another session | `time_log_id`, `employee_id`, `clock_out_at?` | manager/admin |

### 8.5 Projects & clients

| Tool | Description | Key inputs | Who |
|---|---|---|---|
| `projects_list` | List projects | `status?`, `company_id?`, pagination | RLS |
| `projects_get` | Get project | `id` | RLS |
| `projects_create` | Create project | `name`, `company_id`, optional fields | admin/manager |
| `clients_list` | List clients | `company_id?`, pagination | RLS |
| `clients_get` | Get client | `id` | RLS |

### 8.6 Leave

| Tool | Description | Key inputs | Who |
|---|---|---|---|
| `leave_request` | Submit leave | `start_date`, `end_date`, `half_day`, `half_day_period?`, `reason` | self |
| `leave_list` | List leave requests | `status?`, pagination | RLS |
| `leave_review` | Approve/reject leave | `id`, `decision` (`approved`/`rejected`), `review_note?` | manager/admin |

### 8.7 CRM / leads

| Tool | Description | Key inputs | Who |
|---|---|---|---|
| `leads_list` | List leads | `status?`, pagination | RLS |
| `leads_update_status` | Update lead status | `id`, `status` | admin or assignee |
| `leads_assign` | Assign lead | `lead_id`, `employee_id` | admin |

Lead status: `new | contacted | qualified | converted | lost`

### 8.8 Documents

| Tool | Description | Key inputs | Who |
|---|---|---|---|
| `documents_list` | List documents | `project_code?`, `tactic_code?`, `employee_code?`, `company_code?`, pagination | RLS |
| `documents_get` | Metadata + signed URL | `id` | RLS |

### 8.9 Training

| Tool | Description | Key inputs | Who |
|---|---|---|---|
| `training_list_modules` | List modules | none | published (admin sees all) |
| `training_get_module` | Module + quiz questions (answers hidden) | `id` | RLS |
| `training_get_progress` | User progress | `module_id?` | self |
| `training_submit_quiz` | Submit answers | `module_id`, `answers[{question_id,selected_option_id}]` | self |

### 8.10 Reports

| Tool | Description | Key inputs | Who |
|---|---|---|---|
| `reports_timesheet` | Timesheet summary | `start_date`, `end_date`, `employee_id?` | scoped |
| `reports_work_orders` | Status breakdown | `project_id?` | RLS |
| `reports_project_progress` | Project completion % | `project_id` | RLS |

### 8.11 Notifications & announcements

| Tool | Description | Key inputs | Who |
|---|---|---|---|
| `notifications_list` | Inbox + unread count | `unread_only?`, pagination | self |
| `notifications_mark_read` | Mark one read | `id` | self |
| `announcements_list` | Published announcements for user | pagination | self |

---

## 9. Resources & prompts (optional)

### Resources

| URI | Purpose |
|---|---|
| `wsso://roles` | Role permission summary |
| `wsso://statuses` | Status/priority enums |
| `wsso://org-hierarchy` | Visible companies/teams |

### Prompts

| Prompt | Purpose |
|---|---|
| `weekly_review` | Weekly work/time/leave summary |
| `project_status` | Project health summary |
| `onboard_employee_checklist` | New employee checklist |

---

## 10. Suggested agent workflows for Workforce 2.0

### A. Daily assistant
1. `employees_me`
2. `time_active_session`
3. `tactics_list` (assigned to me, not done)
4. `notifications_list` (`unread_only: true`)

### B. Clock in / out
1. `time_clock_in` / `time_clock_out`
2. Confirm with `time_active_session`

### C. Complete a work order
1. `tactics_get`
2. `tactics_submit_work_update`
3. `tactics_transition_status` → `review`

### D. Manager morning review
1. `tactics_list` (`status: review`)
2. `leave_list` (`status: pending`)
3. `time_team_logs`

---

## 11. Dashboard implementation checklist (Workforce 2.0)

- [ ] Add “WSSO” integration card in Integrations/MCP settings
- [ ] Capture MCP URL (pre-filled: `https://wsso.vercel.app/api/mcp/mcp`)
- [ ] Capture Bearer token (secure input)
- [ ] Test connection button (initialize + tools/list)
- [ ] Show discovered tool count / names
- [ ] Persist token per Workforce 2.0 user (encrypted)
- [ ] Auto-handle 401 → “Reconnect WSSO account”
- [ ] Ensure every MCP request sends Authorization header
- [ ] Support GET/POST/DELETE on MCP endpoint
- [ ] Log tool calls for audit (without token values)
- [ ] Document for your end users: how to get WSSO token

---

## 12. Error handling guide

| Error | Meaning | Workforce 2.0 action |
|---|---|---|
| `invalid_token` / no authorization | Header missing | Ask user to connect / paste token |
| 401 Unauthorized | Bad/expired token | Prompt reconnect |
| Tool `isError`: Unauthorized... | Role restriction | Show friendly permission message |
| Tool `isError`: Cannot transition... | Work-order rule blocked action | Explain allowed next status |
| Network / 5xx | Temporary outage | Retry with backoff |

---

## 13. What Workforce 2.0 does NOT need to build

- No need to rebuild WSSO business logic
- No need for direct database access
- No need for Supabase service-role key
- No need to host the MCP server

You only need an MCP client in your dashboard that talks to the hosted WSSO endpoint with the user’s token.

---

## 14. Acceptance test plan (for your QA)

1. Connect with a valid employee token → `employees_me` returns that employee  
2. Without token → 401 `No authorization provided`  
3. Employee cannot call `tactics_create`  
4. Employee can `time_clock_in` / `time_clock_out`  
5. Manager can `tactics_create`  
6. Manager cannot transition assignee work from `assigned` → `in_progress`  
7. `tools/list` returns ~45 tools  
8. Expired token → reconnect flow works  

---

## 15. Support & handoff

| Topic | Owner |
|---|---|
| MCP server uptime / deploy | WSSO team |
| Tool behavior / permissions | WSSO team |
| Dashboard MCP client UI | Workforce 2.0 team |
| Token storage / UX in agent product | Workforce 2.0 team |

**Production MCP URL:** `https://wsso.vercel.app/api/mcp/mcp`  
**WSSO app:** https://wsso.vercel.app  

For API questions during integration, contact the WSSO engineering owner with:
- request timestamp
- tool name
- user role (not the raw token)
- response status / error text

---

## 16. Change log

| Version | Date | Notes |
|---|---|---|
| 1.0 | Aug 2026 | Initial partner integration guide for Workforce 2.0 |

---

**End of document**
