# WSSO — Full Project Audit & Dashboard Guide

**Audit date:** June 30, 2026  
**Version:** 0.1.0 (alpha)  
**Stack:** Next.js 14 · React 18 · TypeScript · Tailwind · Supabase  
**Build status:** ✅ `npm run build` passes · ✅ `npm run lint` passes  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What Is Working](#2-what-is-working)
3. [What Is Wrong or Not Working](#3-what-is-wrong-or-not-working)
4. [Role Overview](#4-role-overview)
5. [Dashboard Guide (By Role)](#5-dashboard-guide-by-role)
6. [Every Page — Features & How To Use](#6-every-page--features--how-to-use)
7. [Setup & Environment](#7-setup--environment)
8. [Database & Data Model](#8-database--data-model)
9. [Recommended Fix Priority](#9-recommended-fix-priority)

---

## 1. Executive Summary

**WSSO (Work System Organizer)** is an internal operations platform for managing work orders (tactics), time tracking, org hierarchy, documents, and reports. It is built for a multi-company org with four user roles: **Admin**, **Director**, **Manager**, and **Employee**.

**Overall health:** The core product is functional. Auth, tactics, kanban, time tracking, employees, companies, projects, clients, documents, reports, and notifications all work when Supabase is configured correctly. The production build compiles with no TypeScript or ESLint errors.

**Main gaps:**
- **Activity Log page** is a placeholder only (data exists in DB but no UI).
- **Director role** is half-wired — gets admin-style dashboard but is blocked from many admin/manager pages.
- **Navigation** shows links to pages some roles cannot access (redirect loop to dashboard).
- **Auto-logout cron** is likely broken in production because middleware requires auth before the cron secret is checked.
- **No delete** for tactics, projects, or clients (only companies and documents have delete).
- **Missing env docs** — `CRON_SECRET` is used but not in `.env.local.example`.

---

## 2. What Is Working

| Area | Status | Notes |
|------|--------|-------|
| Authentication | ✅ | Login, forgot/reset password, inactive account blocking |
| Session middleware | ✅ | Protects routes, refreshes Supabase cookies |
| Admin dashboard | ✅ | Org-wide stats, charts, overdue list |
| Manager dashboard | ✅ | Team stats, review queue, team activity table |
| Employee dashboard | ✅ | Clock widget, task buckets, hours summary |
| Tactics (CRUD-ish) | ✅ | Create, edit, status transitions, log hours |
| Kanban board | ✅ | Drag-and-drop + Supabase Realtime sync |
| Time tracking | ✅ | Clock in/out, weekly chart, admin corrections |
| Employees | ✅ | Create via API, edit profile, activate/deactivate |
| Companies | ✅ | Full CRUD |
| Clients | ✅ | Add/update (no delete) |
| Projects | ✅ | Add/update + detail page (no delete) |
| Teams & hierarchy | ✅ | Under Admin Settings |
| Documents | ✅ | Upload to Supabase Storage, download, delete |
| Reports (5 types) | ✅ | Daily/weekly time, performance, projects, work orders |
| Notifications | ✅ | In-app + Realtime bell |
| Email (optional) | ✅ | Resend for welcome/set-password emails |

---

## 3. What Is Wrong or Not Working

### 🔴 Critical — Auto-logout cron blocked by middleware

**Problem:** Vercel Cron calls `GET /api/cron/auto-logout` daily (see `vercel.json`). Middleware treats all `/api/*` routes as protected. Cron has no Supabase session → **401 Unauthorized** before `CRON_SECRET` is ever checked.

**File:** `src/middleware.ts` — `/api/cron/` is not in `PUBLIC_PREFIXES`.

**Fix:**
```typescript
const PUBLIC_PREFIXES = ['/auth/', '/api/public/', '/api/cron/']
```
Then set `CRON_SECRET` in Vercel env and configure Vercel Cron to send `Authorization: Bearer <CRON_SECRET>`.

**Impact:** Employees who forget to clock out stay “clocked in” indefinitely until manual correction.

---

### 🟠 High — Director role is inconsistent

**Problem:** `director` exists in DB, UI, and RLS (read-all policies), but app routing treats directors like a mix of admin and employee:

| Capability | Director gets? | Why |
|------------|----------------|-----|
| Admin dashboard (org-wide stats) | ✅ | `dashboard/page.tsx` maps director → `AdminDashboard` |
| Create tactics | ❌ | `createTactic` requires admin or manager |
| Approve review → done | ❌ | `getAllowedNext()` treats director like employee |
| Reports | ❌ | `requireRole(['admin', 'manager'])` |
| Employees page | ❌ | Middleware + nav `roles: ['admin', 'manager']` |
| Team Time | ❌ | Same |
| Clients / Projects list | ❌ | Page redirect if not admin/manager |
| Companies / Settings | ❌ | Middleware admin-only |
| Read all data (RLS) | ✅ | DB policies allow director SELECT everywhere |

**Decision needed:** Is director a **read-only executive** (view everything, change nothing) or a **super-manager** (like admin minus settings)? Wire routes, nav, and server actions accordingly.

---

### 🟠 High — Navigation vs page access mismatch

**Problem:** Sidebar shows links employees and directors cannot use. Clicking them redirects to `/dashboard` — confusing UX.

| Nav item | Shown to | Actually allowed |
|----------|----------|------------------|
| Projects | Everyone | admin, manager only |
| Clients | Everyone | admin, manager only |
| Reports | Everyone | admin, manager only |
| Team Time | admin, manager | ✅ correct |
| Employees | admin, manager | ✅ correct |
| Companies | admin | ✅ correct |

**Fix:** Add `roles: ['admin', 'manager']` to Projects, Clients, and Reports in `src/lib/nav.ts`. If director should see reports, add `'director'` to both nav and `reports/page.tsx`.

---

### 🟡 Medium — Activity Log page is a stub

**Problem:** Nav link exists; page only shows: *“Activity Log — full audit trail coming in the next build step.”*

**Reality:** `activity_logs` table is populated on tactic create, status change, and hours logged. Tactic detail page already shows per-tactic timeline (`ActivityTimeline.tsx`). What's missing is a **global** audit log page with filters (date, employee, tactic, action type).

**File:** `src/app/(dashboard)/activity-log/page.tsx`

---

### 🟡 Medium — Missing delete operations

| Entity | Delete available? |
|--------|-------------------|
| Companies | ✅ |
| Teams | ✅ |
| Documents | ✅ |
| Tactics | ❌ |
| Projects | ❌ |
| Clients | ❌ |
| Employees | ❌ (deactivate only) |

Workaround: archive tactics (status → archived). Projects/clients have no soft-delete.

---

### 🟡 Medium — Environment documentation gap

`CRON_SECRET` is checked in `src/app/api/cron/auto-logout/route.ts` but **not listed** in `.env.local.example`.

Also verify in Supabase Dashboard:
- Auth → URL configuration (redirect URLs for `/auth/callback`, `/reset-password`)
- Storage bucket `documents` (auto-created on first upload, 50MB limit)
- Run migrations in `supabase/migrations/`

---

### 🟢 Low — Dead code & minor issues

| Issue | Location |
|-------|----------|
| Unused `src/lib/supabase/middleware.ts` | Duplicate of session logic; never imported |
| Company assignment can fail silently on user create | `src/app/api/admin/users/route.ts` — user created but companies unlinked |
| Admin accounts cannot be created via UI | Must be created directly in Supabase |
| Empty README | Only `# wsso` |
| No automated tests | No test scripts in `package.json` |

---

## 4. Role Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  ADMIN          Full org control — companies, settings, all data │
│  DIRECTOR       Read-all at DB level; UI partially wired (see §3)│
│  MANAGER        Team-scoped — tactics, time, employees, reports  │
│  EMPLOYEE       Own tasks, own time, documents, notifications    │
└─────────────────────────────────────────────────────────────────┘
```

### Sidebar visibility (intended vs actual)

| Section / Page | Admin | Director | Manager | Employee |
|----------------|:-----:|:--------:|:-------:|:--------:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Tactics | ✅ | ✅ (view) | ✅ | ✅ |
| Kanban | ✅ | ✅ | ✅ | ✅ |
| Employees | ✅ | ❌* | ✅ | ❌ |
| Companies | ✅ | ❌ | ❌ | ❌ |
| Projects | ✅ | ❌* | ✅ | ❌* |
| Clients | ✅ | ❌* | ✅ | ❌* |
| My Time | ✅ | ✅ | ✅ | ✅ |
| Team Time | ✅ | ❌ | ✅ | ❌ |
| Documents | ✅ | ✅ | ✅ | ✅ |
| Reports | ✅ | ❌ | ✅ | ❌* |
| Activity Log | ✅ stub | ✅ stub | ✅ stub | ✅ stub |
| Notifications | ✅ | ✅ | ✅ | ✅ |
| Admin Settings | ✅ | ❌ | ❌ | ❌ |

\*Shown in nav but page redirects to dashboard.

---

## 5. Dashboard Guide (By Role)

### 5.1 Admin Dashboard (`/dashboard`)

**Who sees it:** `admin`, `director`  
**Component:** `src/components/dashboard/AdminDashboard.tsx`

#### What it shows

| Widget | Data source | Purpose |
|--------|-------------|---------|
| **Companies** | Count of all companies | Org size |
| **Employees** | Active profiles count | Headcount |
| **Active projects** | Projects with status `active` | Pipeline health |
| **Open** | Tactics with status `assigned` | Unstarted work |
| **In Progress** | Tactics with status `in_progress` | Active work |
| **Overdue** | Tactics past `due_date`, not done/archived | Risk indicator (red if > 0) |
| **Tactic completion chart** | `activity_logs` where action = "Status changed to Done", last 30 days | Throughput trend |
| **Company hours chart** | `time_logs` last 7 days, all employees | Utilization |
| **Overdue employees list** | Top 7 assignees by overdue count | Drill-down to `/employees/[id]` |

#### How to use it (admin workflow)

1. **Morning check:** Scan Overdue stat + overdue employees list → click employee profile → review their tactics.
2. **Capacity:** Company hours chart shows if org is logging time consistently.
3. **Throughput:** Completion chart shows daily done-count — spot dips.
4. **Drill-down:** Every stat is a starting point; use sidebar to go to Tactics, Reports, or Team Time for detail.

#### Director caveat

Directors see the same dashboard but **cannot** click through to Employees (middleware blocks `/employees`). Overdue list links will redirect them to dashboard.

---

### 5.2 Manager Dashboard (`/dashboard`)

**Who sees it:** `manager`  
**Component:** `src/components/dashboard/ManagerDashboard.tsx`

#### What it shows

| Widget | Data source | Purpose |
|--------|-------------|---------|
| **Team size** | Active profiles in manager's team (RLS-scoped) | Team headcount |
| **Open / In Progress / Overdue** | Team tactics by status | Workload snapshot |
| **Needs your approval** | Tactics in `review` status | Manager must approve → done |
| **Team hours chart** | Team `time_logs`, last 7 days | Team utilization |
| **Team activity table** | Per-member: today hours, week hours, open task count | Daily standup view |

#### How to use it (manager workflow)

1. **Review queue (top priority):** "Needs your approval" lists tactics employees submitted for review. Click **Review** → open tactic → change status to **Done** or send back to **In Progress**.
2. **Standup:** Team activity table — who logged time today? Who has too many open tasks?
3. **Overdue:** If overdue count > 0, go to **Tactics** or **Kanban** and filter/sort by due date.
4. **Reports:** Use `/reports` for printable weekly time or performance exports.

#### Status workflow (manager powers)

```
assigned → in_progress → review → done → archived
                              ↑         ↓
                         (can send back to in_progress)
```

Managers and admins can move tactics through the full lifecycle. Employees/directors can only push forward until `review`.

---

### 5.3 Employee Dashboard (`/dashboard`)

**Who sees it:** `employee`  
**Component:** `src/components/dashboard/EmployeeDashboard.tsx`

#### What it shows

| Widget | Data source | Purpose |
|--------|-------------|---------|
| **Clock widget** | Live clock in/out state | Start/end work day |
| **Today / This week hours** | Own `time_logs` | Personal time summary |
| **Completed (30 days)** | Own tactics with status `done` | Productivity |
| **Overdue count** | Own tactics past due date | Urgency |
| **Task sections** | Overdue / Due today / Due this week | Prioritized task list |
| **Quick links** | My Time, All My Tasks | Navigation shortcuts |

#### How to use it (employee workflow)

1. **Start of day:** Use **Clock widget** on dashboard → Clock In.
2. **Work through tasks:** Overdue (red) → Due today (amber) → Due this week.
3. **On each task:** Click task → open detail → Start (→ in progress) → Log hours → Submit for review.
4. **End of day:** Clock Out on dashboard or `/time`.
5. **Documents:** Upload files linked to your tactics from `/documents`.

#### Tactic lifecycle (employee)

```
assigned → in_progress → review → (wait for manager approval)
```

Employee **cannot** mark done themselves — must go through review.

---

## 6. Every Page — Features & How To Use

### Auth

| Route | Purpose | How to use |
|-------|---------|------------|
| `/login` | Email + password sign in | Inactive accounts are signed out immediately |
| `/forgot-password` | Request reset email | Uses Supabase Auth email |
| `/reset-password` | Set new password | After recovery link from email |
| `/auth/callback` | OAuth/PKCE handler | Automatic — don't link manually |
| `/auth/signout` | POST sign out | Used by sign-out button in UI |

**First admin:** Create user in Supabase Dashboard → set `profiles.role = 'admin'`. UI cannot create admin accounts.

**New employee:** Admin → Employees → Create → temp password emailed (Resend or Supabase SMTP) → employee sets password at `/reset-password`.

---

### Work — Tactics (`/tactics`)

**Access:** All roles (RLS scopes data)

| Action | Who | How |
|--------|-----|-----|
| View list | All | Auto-filtered by role via RLS |
| Create tactic | admin, manager | "New Tactic" button → title, assignee, priority, due date, project, estimated hours |
| Edit tactic | admin, manager | Row actions or detail page |
| Change status | admin, manager (full); employee/director (limited) | Status buttons on detail or Kanban |
| Log hours | Assignee + managers | Hours dialog on tactic detail |
| View activity | All with access | Timeline on tactic detail |

**Auto codes:** TAC001, TAC002, …

**Priority:** low, medium, high, critical  
**Status:** assigned → in_progress → review → done → archived

---

### Work — Kanban (`/kanban`)

**Access:** All roles

- Columns: Assigned, In Progress, Review, Done
- **Drag and drop** cards to change status (respects `getAllowedNext()` rules)
- **Realtime:** Other users' changes appear live via Supabase Realtime
- Click card → tactic detail

---

### Organization — Employees (`/employees`)

**Access:** admin, manager (middleware)

| Action | Who | How |
|--------|-----|-----|
| List employees | admin (all), manager (team via RLS) | Table with search/filter |
| Create employee | admin | Create dialog → API creates auth user + profile + company links |
| View profile | admin, manager | Click row → `/employees/[id]` |
| Edit profile | admin, manager | Name, role, team, companies, status |
| Deactivate | admin, manager | Set status inactive — blocks login |

**Roles assignable on create:** director, manager, employee (not admin)

---

### Organization — Companies (`/companies`)

**Access:** admin only

| Action | How |
|--------|-----|
| Create | Company dialog — auto code TLB001… |
| Edit | Row edit |
| Delete | Row delete (cascades per DB rules) |

---

### Organization — Projects (`/projects`)

**Access:** admin, manager (employees redirected)

| Action | Who | How |
|--------|-----|-----|
| List | admin (all), manager (own projects via RLS) | Projects table |
| Create | admin, manager | Project dialog — link company, client, manager |
| Edit | admin, manager | Row edit |
| View detail | All with RLS access | `/projects/[id]` — linked tactics |

**Auto codes:** PRJ001…  
**Note:** No delete. Set status to completed/cancelled instead.

---

### Organization — Clients (`/clients`)

**Access:** admin, manager

| Action | How |
|--------|-----|
| Add client | Client dialog — link to company, auto code CLI001… |
| Edit | Row edit |

**Note:** No delete action in server actions.

---

### Organization — Admin Settings / Hierarchy (`/settings/hierarchy`)

**Access:** admin only

| Tab / Section | Purpose |
|---------------|---------|
| **Teams** | Create/edit/delete teams within companies |
| **Org assignment** | Assign employees to teams, set manager, company links |

This is where org structure is maintained. There is no separate `/teams` route.

---

### Time — My Time (`/time`)

**Access:** All roles

| Action | How |
|--------|-----|
| Clock in | Clock widget — one open session per employee (DB enforced) |
| Clock out | Same widget |
| View history | Session table with dates and durations |
| Weekly chart | Bar chart of hours per day |

**Auto-logout:** Sessions open >12h should be closed by cron (currently broken — see §3).

---

### Time — Team Time (`/time/team`)

**Access:** admin, manager

| Action | How |
|--------|-----|
| View all team members' hours | Summary table |
| Drill into employee | `/time/team/[employeeId]` — full log + chart |
| Admin correct entry | Edit dialog — adjust clock in/out times |

---

### Content — Documents (`/documents`)

**Access:** All roles (RLS scopes visibility)

| Action | How |
|--------|-----|
| Upload | Upload dialog — attach to tactic, project, or client |
| Search/filter | By entity type and name |
| Download | Signed URL (temporary) |
| Delete | admin, director, or uploader |

**Storage:** Supabase bucket `documents`, max 50MB per file.

---

### Content — Reports (`/reports`)

**Access:** admin, manager

Five report types (left panel picker):

| Report | What it shows | Filters |
|--------|---------------|---------|
| **Daily Time** | Hours per employee for one day | Date picker |
| **Weekly Time** | Daily breakdown per employee for a week | Week start date |
| **Employee Performance** | Assigned, completed, overdue, avg completion days, clock hours | Date range |
| **Project Progress** | Tactics done vs total, estimated vs logged hours | Optional project filter |
| **Work Orders** | Filtered tactic list for print/export | Status, priority, assignee, project, dates |

**Manager scope:** Data auto-limited to their team via RLS in server actions.  
**Print:** Browser print — report layout hides sidebar (`print:` Tailwind classes).

---

### Content — Activity Log (`/activity-log`)

**Access:** All roles  
**Status:** ❌ **NOT IMPLEMENTED** — placeholder text only

**What exists today:** Per-tactic activity on `/tactics/[id]` (status changes, hours logged, created).

**What to build:** Global log querying `activity_logs` joined with profiles and tactics, with filters by date range, employee, action type, tactic code.

---

### Notifications (`/notifications`)

**Access:** All roles

- In-app notification list
- Bell icon in topbar with unread count (Realtime)
- Types include tactic assigned, status changes, etc.
- Mark read / mark all read

---

## 7. Setup & Environment

### Required steps

1. Copy `.env.local.example` → `.env.local`
2. Fill Supabase URL, anon key, service role key
3. Set `NEXT_PUBLIC_APP_URL` (production domain for auth redirects)
4. Run SQL migrations in Supabase SQL editor (order: initial schema → profile trigger)
5. Create first admin user in Supabase Auth + set `profiles.role = 'admin'`
6. `npm install` → `npm run dev`

### Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public key (client + middleware) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Admin ops (user create, storage, cron, activity logs) |
| `NEXT_PUBLIC_APP_URL` | Yes (prod) | Auth redirect URLs |
| `RESEND_API_KEY` | Optional | Custom welcome emails |
| `EMAIL_FROM` | Optional | Sender address |
| `CRON_SECRET` | **Recommended** | Protects auto-logout cron (add to `.env.local.example`) |

### Deploy (Vercel)

- Set all env vars in Vercel project settings
- Cron runs daily at 00:00 UTC (`vercel.json`)
- **Must fix middleware** to allow `/api/cron/` without session
- Configure Vercel Cron Authorization header with `CRON_SECRET`

---

## 8. Database & Data Model

### Core tables

| Table | Purpose | Auto-code |
|-------|---------|-----------|
| `companies` | Top-level business entities | TLB001… |
| `profiles` | One row per auth user | EMP001… |
| `teams` | Groups within companies | — |
| `employee_companies` | M2M employee ↔ company | — |
| `clients` | Business clients | CLI001… |
| `projects` | Projects (company + client + manager) | PRJ001… |
| `tactics` | Work orders / tasks | TAC001… |
| `activity_logs` | Tactic audit trail | — |
| `time_logs` | Clock in/out sessions | — |
| `documents` | File metadata (Storage paths) | — |
| `notifications` | In-app notifications | — |

### Tactic status flow

```
     ┌──────────┐     ┌─────────────┐     ┌────────┐     ┌──────┐     ┌──────────┐
     │ assigned │ ──► │ in_progress │ ──► │ review │ ──► │ done │ ──► │ archived │
     └──────────┘     └─────────────┘     └────────┘     └──────┘     └──────────┘
                            ▲                  │
                            └──────────────────┘  (manager can send back)
```

### Security layers

1. **Middleware** — route-level role checks
2. **Page guards** — `requireProfile()`, `requireRole()`, redirects
3. **Server actions** — role checks before mutations
4. **Supabase RLS** — row-level data isolation

---

## 9. Recommended Fix Priority

| Priority | Task | Effort |
|----------|------|--------|
| P0 | Exempt `/api/cron/` from auth middleware; document `CRON_SECRET` | Small |
| P1 | Fix nav role filters for Projects, Clients, Reports | Small |
| P1 | Decide director role — update routes, nav, `createTactic`, `getAllowedNext`, reports | Medium |
| P2 | Implement Activity Log page (data already exists) | Medium |
| P2 | Add soft-delete or archive for projects/clients | Medium |
| P3 | Remove dead `src/lib/supabase/middleware.ts` | Trivial |
| P3 | Expand README with setup guide | Small |
| P3 | Add basic test suite | Large |

---

## Quick Reference — Who Can Do What

| Action | Admin | Director | Manager | Employee |
|--------|:-----:|:--------:|:-------:|:--------:|
| Create company | ✅ | ❌ | ❌ | ❌ |
| Create employee | ✅ | ❌ | ❌ | ❌ |
| Create tactic | ✅ | ❌ | ✅ | ❌ |
| Approve review → done | ✅ | ❌ | ✅ | ❌ |
| Work on assigned tactic | ✅ | ✅* | ✅ | ✅ |
| Clock in/out | ✅ | ✅ | ✅ | ✅ |
| View reports | ✅ | ❌ | ✅ | ❌ |
| Upload documents | ✅ | ✅ | ✅ | ✅ |
| Delete documents | ✅ | ✅ | own | own |
| Admin settings | ✅ | ❌ | ❌ | ❌ |

\*Director can work on own assigned tactics but cannot approve others' review items.

---

*Generated by project audit — WSSO v0.1.0*
