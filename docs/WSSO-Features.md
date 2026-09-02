# WSSO — Product features

**WSSO** (Work Management System) is the daily operating system for a company: time, leave, work orders, people, clients, CRM, training, documents, and billing in one workspace.

Each paying customer gets **one company workspace**. People in that workspace only see their own company. An admin can turn modules on or off and edit lists (leave types, job types, skills, and so on) so the product fits that company without custom software.

**Who this document covers:** Admin, Director, Manager, and Employee.  
It does not cover platform / Super Admin.

---

## Purpose

WSSO is for SMEs that need one place to:

- Know **who is working** and how many hours they put in
- Assign and finish **jobs** (work orders) with a paper trail
- Take **leads** through to a **client**
- Approve **leave** and clock notes without hunting across screens
- Keep **licenses, training, and documents** from going stale
- Let the owner **configure** the product (features, overtime, locations) instead of asking for a custom build

Seller of record: **TLBISBIG Consulting Group, LLC** (United States). Billing is in USD via Stripe.

---

## Roles in a workspace

| Role | Job in WSSO |
|---|---|
| **Admin** | Owns the workspace. Pays the subscription. Configures features, people, companies, CRM, and billing. Sees the full company dashboard. |
| **Director** | Same home dashboard as Admin (company overview). Does not manage billing, CRM admin, or workspace settings. |
| **Manager** | Runs a team: team time, team leave, approvals, projects, clients, reports. Home dashboard is team-scoped. |
| **Employee** | Clocks in/out, does assigned work, requests leave, completes training, works assigned leads. |

If the subscription lapses, only the **Admin** can open **Subscription** and pay. Everyone else is locked to a payment message.

An Admin can hide modules in **Workspace → Features**. Hidden items leave the sidebar and related dashboard cards.

---

## Dashboards (`/dashboard`)

After login, WSSO opens the home dashboard for that person’s role.

### Admin dashboard (Admin and Director)

**Purpose:** See the whole company at a glance and jump to what needs action today.

| On this dashboard | What it is |
|---|---|
| Clock | Clock in / out (notes can be required by workspace rules) |
| Today strip | Approvals waiting, licenses expiring in 30 days, overdue CRM follow-ups (follow-ups: Admin only) |
| Who is working now | Everyone currently clocked in |
| Stat cards | Companies, employees, active projects, open / in-progress / overdue work orders, TACTICs pending review |
| CRM card | New leads shortcut (Admin only, if CRM is on) |
| My Work card | Personal work sheets |
| Training card | Training that is due |
| Announcements | Latest company posts |
| Charts | Work completed (30 days) and company hours (7 days) |
| Overdue list | Employees with overdue tasks |

Director sees the same overview. Approvals and Licenses counts are for Admin/Manager only.

### Manager dashboard

**Purpose:** Run the team today — hours, open work, and who is on the clock.

| On this dashboard | What it is |
|---|---|
| Clock | Clock in / out |
| Who is working now | Team members currently clocked in |
| Stat cards | Team size, open / in-progress / overdue work, TACTICs pending |
| Hours chart | Team hours, last 7 days |
| Team list | Each person: today / week hours and open jobs |
| Work in review | Jobs waiting for the manager |
| My Work / Training / Announcements | Same cards as other roles |

Approvals and Licenses are in the **sidebar**, not as the three-count strip on this home screen.

### Employee dashboard

**Purpose:** Start the day — clock, hours, and what is due.

| On this dashboard | What it is |
|---|---|
| Clock | Clock in / out |
| My Work card | Personal work sheets |
| Training card | Assigned / incomplete training |
| Stat cards | Hours today, hours this week, jobs completed (30 days), overdue jobs |
| Shortcuts | My Time, My Work, Training, all my tasks |
| Lists | Overdue, due today, due this week |

---

## All features (by area)

Items marked *Admin can hide* can be turned off in **Workspace → Features**.

### Work

| Feature | Where | Who | Purpose |
|---|---|---|---|
| **My Work** *Admin can hide* | `/my-work` | Everyone | Personal work sheets, folders, sharing |
| **TACTICs** | `/tactic-documents` | Everyone (by access) | Longer planning documents, tasks, next steps, review |
| **Work orders** | `/tactics` | Everyone (own or team) | Assign jobs, status, due date, hours, multiple assignees |
| **Kanban** *Admin can hide* | `/kanban` | Everyone | Board view of work orders by status |
| **Job checklist** *Admin can hide* | Work order detail | People on the job | Tick steps from an admin template |
| **Job costing** *Admin can hide* | Work order detail | People who can open the job | Hours logged × person’s hourly rate vs estimate |
| **Recurring jobs** *Admin can hide* | Workspace settings | Admin (create); everyone (receives the job) | Daily / weekly / monthly jobs auto-created |

Work order statuses: Assigned → In progress → Review → Done (and Archived).

### Organization

| Feature | Where | Who | Purpose |
|---|---|---|---|
| **Employees** | `/employees` | Admin, Manager | Directory, profile, status, org assignment |
| **Companies** | `/companies` | Admin | Business entities inside the workspace |
| **Projects** | `/projects` | Admin, Manager | Jobs grouped under a company / client |
| **Clients** | `/clients` | Admin, Manager | Client records, contacts |
| **Hierarchy** | Workspace → People | Admin | Teams, managers, which companies a person belongs to |
| **Pay & skills** | Workspace → Pay & skills | Admin | Hourly rate, location, backup approver, skills |
| **Locations** | Workspace → Locations | Admin | Branches / sites; assign people and jobs |
| **Custom fields** *Admin can hide* | Workspace → Custom fields | Admin defines; used on records | Extra fields (site code, truck, crop type, …) with no custom code |

### CRM *Admin can hide*

| Feature | Where | Who | Purpose |
|---|---|---|---|
| **CRM** | `/crm` | Admin | All leads: add one, CSV bulk upload, assign, edit, status |
| **My Leads** | `/my-leads` | Anyone assigned a lead | Work your leads |
| **Convert lead → client** | CRM row | Admin | Create a client (optional kickoff project) |
| **Win / lost reasons** | CRM row | Admin | Why the deal was won or lost (admin-defined list) |
| **Follow-ups** *Admin can hide* | CRM row | Admin | Next action and due date; overdue count on Admin dashboard |

Lead statuses: New → Contacted → Qualified → Converted / Lost.

### Time & leave *Admin can hide each module*

| Feature | Where | Who | Purpose |
|---|---|---|---|
| **Clock in / out** | Dashboard, My Time | Everyone | One session per local day; auto-close at local midnight (max 24 hours) |
| **Clock notes** | Clock widget | Everyone | Optional or required (workspace rule); managers approve notes |
| **My Time** | `/time` | Everyone | Own timesheet |
| **Team Time** | `/time/team` | Admin, Manager | Team hours, open sessions, force clock-out, correct entries (admin) |
| **Who is working now** *Admin can hide* | Admin/Manager dashboard, Team Time | Admin, Manager | Live clocked-in list |
| **Payroll CSV** | Team Time | Admin | Hours, overtime, pay for a date range (uses weekly overtime cap and hourly rates) |
| **My Leave** | `/leave` | Everyone | Request leave (types from admin list) |
| **Team Leave** | `/leave/team` | Admin, Manager | See and review team leave |
| **Approvals inbox** *Admin can hide* | `/approvals` | Admin, Manager | Leave + clock notes in one list |
| **Holidays** | Workspace → Locations | Admin | Company holiday calendar |
| **Overtime rule** | Workspace → Work rules | Admin | Overtime after N hours / week |

### Content

| Feature | Where | Who | Purpose |
|---|---|---|---|
| **Training** *Admin can hide* | `/training` | Everyone | Modules, quizzes, pass mark; card on dashboards |
| **Documents** *Admin can hide* | `/documents` | By access | Shared files linked to work |
| **Announcements** *Admin can hide* | `/announcements` | Everyone (Admin/Manager publish) | Company posts; optional email |
| **Licenses & expiry** *Admin can hide* | `/compliance` | Admin, Manager | Driver license, insurance, contracts, certs; 30-day warning on Admin dashboard |
| **Reports** | `/reports` | Admin, Manager | Daily/weekly time, performance, project progress, work orders (manager = team only) |
| **Activity log** | `/activity-log` | Everyone (scoped) | Audit of actions on jobs and time |

### Assist, alerts, billing, setup

| Feature | Where | Who | Purpose |
|---|---|---|---|
| **Connect AI** *Admin can hide* | `/connect-ai` | Everyone (if enabled) | Optional MCP so AI tools use WSSO with the same permissions as the signed-in user |
| **Notifications** | `/notifications` | Everyone | In-app alerts (new job, etc.) |
| **Subscription** | `/settings/billing` | Admin | Choose plan, Stripe checkout, invoices, card, cancel |
| **Workspace settings** | `/settings/workspace` | Admin | Features, work rules, lists, locations, holidays, custom fields, checklists, pay & skills, recurring jobs |

---

## Workspace settings (Admin only)

This is how each company shapes WSSO without a custom build.

| Tab | What the admin sets |
|---|---|
| **People** | Teams, managers, company assignment |
| **Features** | On/off: time, leave, approvals, who is working, job costing, CRM, follow-ups, checklists, recurring jobs, licenses, custom fields, kanban, My Work, training, documents, announcements, Connect AI |
| **Work rules** | Overtime hours/week, target hours/day, required clock notes, required leave type, default SLA hours, require checklist on new jobs, jobs billable by default, CRM follow-up days |
| **Lists** | Leave types, win reasons, lost reasons, skills, license types, job types |
| **Locations** | Sites / branches and company holidays |
| **Custom fields** | Extra fields on employees, clients, leads, work orders, projects |
| **Checklists** | Named templates with required/optional steps |
| **Pay & skills** | $/hour, location, backup approver, skills per person |
| **Recurring jobs** | Title, assignee, project, checklist, repeat (daily/weekly/monthly), next run date |

Default lists after setup include leave types (Vacation, Sick, Personal, Unpaid, Bereavement, Holiday), win/lost reasons, and license types (Driver license, Insurance, Contract, Certification). The admin can add, hide, or rename them.

---

## What each role can do (summary)

### Admin

- Everything a Director sees on the home dashboard  
- Pay and manage **Subscription**  
- Configure **Workspace** (features, rules, lists, locations, pay rates)  
- Full **CRM** (add/import leads, assign, convert, follow-ups)  
- **Companies**, employees, projects, clients  
- **Team Time** including payroll CSV and time corrections  
- **Approvals**, **Team Leave**, **Licenses**, **Reports**  
- Publish training, announcements, documents  

### Director

- Company **Admin dashboard** overview  
- Work, time, leave, training, documents as a user  
- Does **not** open Workspace settings, Subscription, or the CRM admin list  

### Manager

- **Manager dashboard** (team)  
- **Team Time**, **Team Leave**, **Approvals**  
- **Employees**, **Projects**, **Clients**, **Reports**, **Licenses** (team / allowed scope)  
- Create and review work orders  
- Does **not** manage billing, companies list, or workspace-wide settings  

### Employee

- **Employee dashboard**  
- Clock, **My Time**, **My Leave**, **My Work**, assigned **work orders**, **My Leads**, **Training**, **Documents**, **Notifications**  
- Tick checklists and log hours on assigned jobs  
- Cannot approve leave, see payroll export, or change workspace settings  

---

## Billing (workspace Admin)

- Admin picks a live plan (monthly or yearly) and pays with **Stripe**  
- History and card changes go through the Stripe customer portal  
- Seat limits come from the plan  
- If payment is due, the workspace is locked until the Admin pays  

---

## Related files

- Training for end users: `docs/USER_TRAINING_GUIDE.md`  
- Database for workspace ops (lists, checklists, licenses): `saas/09_workspace_ops.sql` — run this in Supabase for the configurable ops features to store data  
