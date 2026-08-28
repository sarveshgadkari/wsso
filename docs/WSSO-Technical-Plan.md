# WSSO Technical Plan  
## Architecture, stack & services

**Document type:** Internal technical architecture  
**Product:** WSSO (Work System Organizer)  
**Production URL:** https://wsso.vercel.app  
**Version:** 1.0  
**Date:** August 2026  

---

## 1. What WSSO is (technically)

WSSO is a **workforce / employee operations web app**:

- Role-based dashboards (Admin, Director, Manager, Employee)
- Work orders, TACTIC meeting docs, Kanban, time & leave
- Organization (companies, teams, projects, clients, employees)
- CRM leads, training, documents, announcements, reports
- **MCP** so AI agents (e.g. Workforce 2.0, Cursor) can use the same data under the same permissions

---

## 2. High-level architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  Users / Browsers / Workforce 2.0 (MCP client)              │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Vercel (Hosting)                                           │
│  • Next.js 14 App (frontend + API routes)                   │
│  • MCP endpoint  /api/mcp/mcp                               │
│  • Cron job      /api/cron/auto-logout                      │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────┐    ┌─────────────────────────────┐
│  Supabase                │    │  Brevo (SMTP)               │
│  • PostgreSQL + RLS      │    │  Invite / set-password mail │
│  • Auth (JWT / cookies)  │    └─────────────────────────────┘
│  • Storage (documents)   │
└──────────────────────────┘
```

---

## 3. Stack summary (what we use)

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend + Backend** | **Next.js 14** (App Router) + React 18 + TypeScript | UI, server actions, API routes |
| **Styling** | Tailwind CSS | Design system / layout |
| **Hosting** | **Vercel** | Deploy app, HTTPS, cron, edge/network |
| **Database** | **Supabase PostgreSQL** | All business data |
| **Auth** | **Supabase Auth** | Login, sessions, JWT, invite/reset |
| **Security** | **Row Level Security (RLS)** | Role / team / assignee data isolation |
| **File storage** | **Supabase Storage** | Uploaded documents (private bucket) |
| **Email** | **Brevo SMTP** via Nodemailer | Set-password / invite emails |
| **AI integration** | **MCP** (Model Context Protocol) | Tools for Workforce 2.0 / Cursor / agents |
| **Forms / validation** | React Hook Form + Zod | Forms + server input validation |
| **Tables / charts** | TanStack Table, Recharts | Lists & reports |
| **Editor** | TipTap | Rich text (My Work / docs-style pages) |
| **Drag & drop** | @dnd-kit | Kanban board |
| **State (UI)** | Zustand | Toasts / lightweight client state |

---

## 4. Frontend (what runs in the browser)

| Item | Detail |
|---|---|
| Framework | Next.js 14 App Router (`src/app`) |
| Language | TypeScript |
| UI | React components under `src/components` |
| Auth session | Cookie-based via `@supabase/ssr` + middleware |
| Roles in UI | Admin / Director / Manager / Employee (sidebar filtered by role) |

### Main modules (product surface)

| Area | Routes / features |
|---|---|
| Dashboard | Role-specific home |
| Work | My Work, TACTICs, Work Orders, Kanban |
| Organization | Employees, Companies, Projects, Clients |
| CRM | CRM (admin), My Leads |
| Time | Clock in/out, team time, leave |
| Content | Training, Documents, Announcements, Reports, Activity Log |
| AI | Connect AI (MCP token for Workforce 2.0) |

---

## 5. Backend (API / server)

There is **no separate Nest/Express server**. Backend logic lives in the same Next.js app:

| Pattern | Where | Used for |
|---|---|---|
| **Server Actions** | `src/lib/actions/*` | Create/update work orders, companies, leads, etc. |
| **API Routes** | `src/app/api/*` | MCP, cron, admin user invite, public lead intake |
| **Middleware** | `src/middleware.ts` | Auth gate + role route protection |
| **Supabase clients** | `src/lib/supabase/*` | Browser, server (cookies), admin (service role) |

---

## 6. Database — Supabase

| Item | Detail |
|---|---|
| Product | Supabase (hosted PostgreSQL) |
| Schema | SQL migrations in `supabase/migrations/` |
| Access control | **RLS policies** per table + helper SQL functions (`get_my_role()`, etc.) |
| Types | Generated/hand-maintained in `src/lib/types/database.ts` |

### Core data domains

| Domain | Examples |
|---|---|
| Org | `companies`, `teams`, `profiles`, `employee_companies` |
| Work | `tactics` (work orders), `tactic_assignees`, `tactic_documents`, tasks/next steps |
| Time | `time_logs`, `leave_requests` |
| CRM | `leads`, `lead_assignments` |
| Content | `documents`, `announcements`, `training_modules`, `notifications` |
| AI | `mcp_connection_tokens` (30-day Connect AI tokens) |

### Auth model

| Concept | How |
|---|---|
| Users | Supabase Auth `auth.users` |
| Profile | `profiles` row (role, employee_code, manager, team) |
| Session in browser | Cookies (`@supabase/ssr`) |
| MCP long-lived token | Opaque `wsso_mcp_…` stored hashed/encrypted; exchanged to short JWT for RLS |

---

## 7. Hosting — Vercel

| Item | Detail |
|---|---|
| Platform | **Vercel** |
| App URL | `https://wsso.vercel.app` |
| What deploys | Full Next.js app (UI + API + MCP) |
| Config | `vercel.json` (cron schedule) |
| Env vars | Set in Vercel Project → Settings → Environment Variables |

### Cron

| Job | Path | Schedule |
|---|---|---|
| Auto-logout / session cleanup | `/api/cron/auto-logout` | Daily (`0 0 * * *`) |

---

## 8. Email — Brevo (SMTP)

| Item | Detail |
|---|---|
| Provider | **Brevo** (SMTP relay) |
| Library | **Nodemailer** |
| Used for | Employee invite / set-password emails, announcements (as configured) |
| Env | `BREVO_SMTP_HOST`, `BREVO_SMTP_PORT`, `BREVO_SMTP_USER`, `BREVO_SMTP_PASSWORD`, `EMAIL_FROM` |

Flow:

1. Admin creates/invites employee in WSSO  
2. App generates set-password link (Supabase)  
3. Email sent through Brevo SMTP  

---

## 9. File storage — Supabase Storage

| Item | Detail |
|---|---|
| Bucket | `documents` (private) |
| Upload path | App uploads via service role; list/open gated by app + RLS on `documents` table |
| Access | Signed URLs after permission check |

---

## 10. AI / MCP integration

| Item | Detail |
|---|---|
| Protocol | Model Context Protocol (MCP) |
| Transport | Streamable HTTP |
| Endpoint | `https://wsso.vercel.app/api/mcp/mcp` |
| Auth | Bearer token (session JWT **or** 30-day `wsso_mcp_…` from Connect AI) |
| Client examples | Workforce 2.0 Custom MCP, Cursor |
| Permissions | Same as logged-in user (RLS + role rules) |

Connect AI page (`/connect-ai`) gives non-tech users:

- MCP URL  
- Long-lived token  
- Workforce paste fields (Server ID / Command / Args or Remote URL)

---

## 11. Environment variables (checklist)

| Variable | Service | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase (server only) | Yes |
| `SUPABASE_JWT_SECRET` | Supabase (Legacy JWT Secret) | Yes (for 30-day MCP tokens) |
| `NEXT_PUBLIC_APP_URL` | App | Yes (`https://wsso.vercel.app`) |
| `BREVO_SMTP_HOST` | Brevo | Yes (for invite email) |
| `BREVO_SMTP_PORT` | Brevo | Yes (`587`) |
| `BREVO_SMTP_USER` | Brevo | Yes |
| `BREVO_SMTP_PASSWORD` | Brevo | Yes |
| `EMAIL_FROM` | Email | Yes |
| `MCP_TOKEN_SECRET` | App | Optional |
| `CRON_SECRET` | Vercel cron auth | Recommended |

---

## 12. Security model (short)

| Layer | Mechanism |
|---|---|
| Login | Supabase Auth |
| Route protection | Next.js middleware + role checks |
| Data isolation | PostgreSQL **RLS** |
| Privileged ops | Service role only on server (invite, storage sign, some admin writes) |
| MCP | Token → user identity → same RLS |
| Secrets | Vercel env / `.env.local` (never commit real keys) |

---

## 13. Local development

```bash
npm install
# copy .env.local.example → .env.local and fill values
npm run dev          # http://localhost:3000
npm run typecheck
npm run test:mcp     # MCP smoke (needs env + running app)
```

Schema changes: add SQL under `supabase/migrations/`, run in Supabase SQL Editor (or CLI push).

---

## 14. Deployment flow

```text
Git push (GitHub)
        │
        ▼
Vercel build (Next.js)
        │
        ▼
https://wsso.vercel.app  (UI + API + MCP live together)
        │
        ├── talks to Supabase (DB / Auth / Storage)
        └── sends mail via Brevo SMTP
```

**Important:** Deploying Vercel does **not** auto-apply SQL. New migrations must be run on Supabase separately.

---

## 15. Cost floor (typical starter — US)

| Service | Typical starter | Notes |
|---|---|---|
| Supabase Pro | ~$25 / mo | DB + Auth + Storage |
| Vercel Pro | ~$20 / mo | App hosting + cron |
| Brevo | Free / paid by volume | SMTP email |
| **Infra floor** | ~$45 / mo | Before seats / usage growth |

(See also `docs/WSSO-Sales-Pricing-Guide.md` for commercial packaging.)

---

## 16. What we intentionally do **not** use (today)

| Not used | Notes |
|---|---|
| Separate backend framework | Logic is Next.js server actions/API |
| Stripe billing in app | Stripe Checkout + Customer Portal + webhooks (`/api/billing/*`) |
| Multi-tenant SaaS orgs | Single deployment / dedicated instances for clients |
| AWS / custom VMs | Vercel + Supabase SaaS |

---

## 17. Related docs

| Doc | Content |
|---|---|
| `README.md` | Quick start + MCP links |
| `docs/MCP.md` | Deploy & connect MCP |
| `docs/WSSO-MCP-Workforce2-Integration-Guide.md` | Partner MCP spec |
| `docs/WSSO-Sales-Pricing-Guide.md` | How we sell |
| `docs/WSSO-SaaS-Conversion-Plan.md` | Path to multi-tenant SaaS |
| `docs/USER_TRAINING_GUIDE.md` | End-user how-to |

---

## 18. One-line summary

**WSSO = Next.js app on Vercel + Supabase (Postgres/Auth/Storage/RLS) + Brevo email + MCP for AI agents.**

---

## Revision log

| Version | Date | Notes |
|---|---|---|
| 1.0 | Aug 2026 | Initial technical plan / stack document |
