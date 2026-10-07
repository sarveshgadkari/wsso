# Daily Work — WSSO

**General time logging by task and category** (direct employees, 1099, subcontractors)

Last updated: October 2026

---

## What it is

**Daily Work** is separate from the **My Time** clock. Use it when you need to record **what you did**, **which category** it belongs to, and **how long** it took — with start and end times on a given day.

Typical uses:

- General / overhead time (Admin, Operations, Marketing, Sales, IT, and so on)
- **Product Development** time on WF2.0, WSSO, Directory, or another product
- **Executive Time** (CEO, COO, CTO, CIO, CMO, CFO, CAIO)
- Tracking work for **1099** or **subcontractor** arrangements (worker type on each entry)

Open it from the sidebar: **Work → Daily Work** (`/daily-work`).

---

## Who can do what

| Role | My work | Review others | Report & CSV |
|------|---------|---------------|--------------|
| **Employee** | Submit, edit, and delete own entries while status is **Submitted** | — | — |
| **Manager** | Same as employee for own entries | **Mark done** for **employees** on their team (direct reports or same managed team). Cannot review other managers. | — |
| **Admin** | Same as employee for own entries | **Mark done** for **everyone**, including managers and directors | **Report** tab: charts, detail table, **Export CSV**. Can **Reopen** a done entry |
| **Director** | Same as employee | — (manager/admin review applies to their entries) | — |

**Important review rules**

- Only **admins** mark **manager** (and other leadership) daily work as done.
- **Managers** only see and approve **employee** role profiles under them — not peers or other managers.
- After an entry is **Done**, the person who submitted it **cannot edit or delete** it. Only an **admin** can reopen it to **Submitted**.

---

## Page layout

### Date range

At the top, choose **From** and **To**, then **Apply dates**. The page loads entries in that range (default is the **current calendar month** when you first open Daily Work).

### Tabs

1. **My work** — form to add or edit your entries, plus your list for the date range.
2. **Everyone** (admin) or **My team** (manager) — review queue; filter **Waiting**, **Done**, or **All**.
3. **Report** (admin only) — summary stats, bar charts, category detail table, CSV export.

---

## Submitting an entry (My work)

Fill in the form and click **Submit work** (or **Save changes** when editing).

| Field | Required | Notes |
|-------|----------|--------|
| **Date** | Yes | The day the work happened |
| **Who this time is for** | Yes | Direct employee, **1099**, or **Subcontractor** |
| **Category** | Yes | See categories below |
| **Product** | If category is Product Development | WF2.0, WSSO, Directory, or Other (+ name if Other) |
| **Executive role** | If category is Executive Time | CEO, COO, CTO, CIO, CMO, CFO, CAIO |
| **Start / End** | Yes | Same-day times; end must be after start |
| **Task** | Yes | Short description of what you did (3–500 characters) |
| **Notes** | No | Optional extra detail |
| **Company** | No | Same companies admins manage under **Organization → Companies**. Use **None** for general overhead time. |
| **Project** | No | Same projects under **Organization → Projects**. Picking a project sets the company automatically. The project list filters when a company is selected. |

**Hours** are calculated automatically from start and end time (same day, up to 24 hours). You cannot submit if the time range is invalid.

Companies and projects are maintained by **admins** (and managers for projects they own). Everyone with Daily Work access can select from the lists when logging time.

### Categories

- Admin  
- Operations  
- Social Media  
- Marketing  
- Business Development  
- Sales  
- IT  
- Product Development *(requires product)*  
- Executive Time *(requires executive role)*  

### Status

- **Submitted** — waiting for review; you can still **Edit** or **Delete**.
- **Done** — reviewed and locked for the submitter.

---

## Review workflow (manager / admin)

1. Open **Everyone** or **My team**.
2. Use the status filter to show **Waiting** entries.
3. Click **Mark done** on an entry you accept.
4. Admins can click **Reopen** on **Done** entries if something needs correction.

Managers will not see **Mark done** on other managers’ rows — those stay for admin review.

---

## Admin report

On the **Report** tab (same date range as the page):

- **Hours**, **Entries**, **Marked done**, **Waiting**
- **Hours by category** (bar chart)
- **Hours by person** (bar chart)
- **Detail** table — hours, entry count, and done count per category
- **Export CSV** — full row list (date, person, role, **company**, **project**, worker type, category, task, times, hours, status, notes)
- **Hours by company** and **Hours by project** charts (alongside category and person)

Use this for payroll support, client billing summaries, or leadership reviews of how time is spent.

---

## Daily Work vs My Time

| | **My Time** (`/time`) | **Daily Work** (`/daily-work`) |
|--|------------------------|--------------------------------|
| Purpose | Clock in/out, attendance-style time | Task-level log with category and description |
| Best for | Shift tracking, who is working now | Admin, sales, marketing, product, executive, 1099/subcontractor buckets |
| Review | Team Time / approvals (separate flows) | Mark done on each daily work entry |

You can use both: clock for attendance and Daily Work for categorized task time.

---

## Workspace setting

Admins can turn the module off: **Settings → Workspace → Features → Daily Work**.

When off, the sidebar link is hidden and `/daily-work` redirects to the dashboard.

---

## Database setup (one-time)

Daily Work stores rows in Supabase table `daily_work_entries`.

If the page says the database update is missing:

1. Open **Supabase → SQL Editor**.
2. Run the script: `saas/13_daily_work.sql` (includes `company_id` and `project_id` on new installs).
3. If Daily Work already existed **before** company/project columns were added, also run `supabase/migrations/20261007000001_daily_work_company_project.sql`.
4. Reload **Daily Work** in WSSO.

The script creates the table, indexes, review helper function, and row-level security for your workspace.

---

## Technical reference (developers)

| Item | Location |
|------|----------|
| UI | `src/components/daily-work/DailyWorkShell.tsx` |
| Server actions | `src/lib/actions/daily-work.ts` |
| Categories & labels | `src/lib/daily-work/catalog.ts` |
| Route | `src/app/(dashboard)/daily-work/page.tsx` |
| Nav | `src/lib/nav.ts` (Work section) |
| Feature flag | `dailyWork` in `src/lib/workspace/settings.ts` |
| SQL | `saas/13_daily_work.sql` |

---

## Quick FAQ

**Can I log multiple tasks on the same day?**  
Yes. Submit one entry per task (or time block).

**Can I log work for a past date?**  
Yes. Set **Date** on the form to any day in your allowed range.

**Why can’t my manager mark my entry done?**  
Check that your profile role is **employee** and that you report to that manager (or are on their team). Managers cannot approve other managers.

**Why is my entry locked?**  
It was marked **Done**. Ask an admin to **Reopen** if it must change.

**Does Daily Work replace the time clock?**  
No. It complements **My Time** for categorized, task-based reporting.
