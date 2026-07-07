# WSSO User Training Guide

**Work System Organizer — How to use WSSO**

Version 0.1.0 · Last updated July 2026

---

## Table of Contents

1. [What is WSSO?](#1-what-is-wsso)
2. [Getting Started](#2-getting-started)
3. [Understanding Your Role](#3-understanding-your-role)
4. [Navigating the App](#4-navigating-the-app)
5. [Daily Workflows by Role](#5-daily-workflows-by-role)
6. [Feature Guides](#6-feature-guides)
   - [Dashboard](#61-dashboard)
   - [My Work](#62-my-work)
   - [TACTIC Documents](#63-tactic-documents)
   - [Work Orders](#64-work-orders)
   - [Kanban Board](#65-kanban-board)
   - [Time Tracking](#66-time-tracking)
   - [Documents](#67-documents)
   - [Announcements](#68-announcements)
   - [Notifications](#69-notifications)
   - [Reports](#610-reports-admin--manager)
   - [Activity Log](#611-activity-log)
   - [Organization (Admin & Manager)](#612-organization-admin--manager)
7. [Work Order Lifecycle](#7-work-order-lifecycle)
8. [Tips & Best Practices](#8-tips--best-practices)
9. [Frequently Asked Questions](#9-frequently-asked-questions)

---

## 1. What is WSSO?

**WSSO (Work System Organizer)** is your company's internal platform for managing day-to-day work. It brings together:

| Area | What you can do |
|------|-----------------|
| **Work** | Track tasks (work orders), use a Kanban board, keep personal spreadsheets and notes |
| **Meetings** | Create TACTIC documents to capture decisions, tasks, and next steps |
| **Time** | Clock in and out, view your hours, and (for managers) review team time |
| **Organization** | Manage employees, companies, projects, and clients (admin/manager) |
| **Communication** | Receive announcements and in-app notifications |
| **Reporting** | Export time and performance reports (admin/manager) |

Everyone signs in with their work email. What you see in the sidebar depends on your **role** (Admin, Director, Manager, or Employee).

---

## 2. Getting Started

### 2.1 Signing in

1. Open your WSSO URL in a web browser (Chrome, Edge, or Firefox recommended).
2. Go to the **Login** page.
3. Enter your **email address** and **password**.
4. Click **Sign in**.

You will land on your **Dashboard**.

> **First-time users:** If you were just invited, check your email for a **set-password** link. Open that link first, create your password, then return to the login page.

### 2.2 Forgot your password?

1. On the login page, click **Forgot password?**
2. Enter your email address.
3. Check your inbox for a reset link.
4. Open the link and set a new password.
5. Sign in with your new password.

### 2.3 Signing out

Click the **Sign out** button in the top-right corner of the screen.

### 2.4 If you cannot sign in

| Problem | What to do |
|---------|------------|
| "Incorrect email or password" | Double-check spelling. If newly invited, complete the set-password email first. |
| "Your account has been deactivated" | Contact your administrator — your account has been set to inactive. |
| Page keeps redirecting to login | Clear browser cookies or try a private/incognito window. Contact IT if it persists. |

---

## 3. Understanding Your Role

WSSO has four roles. Your role controls which pages you see and what actions you can take.

```
┌──────────────────────────────────────────────────────────────────────┐
│  ADMIN       Full control — companies, settings, all employees       │
│  DIRECTOR    Organisation-wide visibility (executive view)         │
│  MANAGER     Manages a team — creates work, approves, runs reports   │
│  EMPLOYEE    Own tasks, own time, personal work area               │
└──────────────────────────────────────────────────────────────────────┘
```

### What each role can do (summary)

| Action | Admin | Director | Manager | Employee |
|--------|:-----:|:--------:|:-------:|:--------:|
| View dashboard | ✅ | ✅ | ✅ | ✅ |
| Clock in / out | ✅ | ✅ | ✅ | ✅ |
| Work on assigned tasks | ✅ | ✅ | ✅ | ✅ |
| Create work orders | ✅ | ❌ | ✅ | ❌ |
| Approve completed work | ✅ | ❌ | ✅ | ❌ |
| Create employees | ✅ | ❌ | ❌ | ❌ |
| Manage companies & settings | ✅ | ❌ | ❌ | ❌ |
| Manage projects & clients | ✅ | ❌ | ✅ | ❌ |
| View team time | ✅ | ❌ | ✅ | ❌ |
| Run reports | ✅ | ❌ | ✅ | ❌ |
| Send announcements | ✅ | ❌ | ✅ | ❌ |
| Create TACTIC documents | ✅ | ❌ | ✅ | ✅ |
| My Work (spreadsheets & notes) | ✅ | ✅ | ✅ | ✅ |

Your role is shown as a coloured badge next to your name in the top bar.

---

## 4. Navigating the App

### Sidebar (left)

The sidebar is your main menu. Sections are grouped by topic:

| Section | Pages |
|---------|-------|
| **—** | Dashboard |
| **Work** | My Work, TACTICs, Work Orders, Kanban Board |
| **Organization** | Employees, Companies, Projects, Clients *(role-restricted)* |
| **Time** | My Time, Team Time *(admin/manager)* |
| **Content** | Documents, Announcements, Reports *(admin/manager)*, Activity Log |
| **—** | Notifications, Admin Settings *(admin only)* |

The currently active page is highlighted in blue.

### Top bar (top)

- Shows the **page title** you are on.
- Displays your **name** and **role**.
- **Notification bell** — click to see unread alerts (badge shows count).
- **Sign out** button.

---

## 5. Daily Workflows by Role

### 5.1 Employee — typical day

```
Morning          →  Clock In (Dashboard or My Time)
                 →  Check Dashboard for overdue / due-today tasks
During the day   →  Open work orders → Start → Log hours
                 →  Use My Work for notes and spreadsheets
                 →  Submit tasks for review when finished
End of day       →  Clock Out
```

**Step-by-step:**

1. **Clock In** using the clock widget on your Dashboard or on **My Time**.
2. Review your task list on the Dashboard: **Overdue** (red) → **Due today** (amber) → **Due this week**.
3. Click a task to open its detail page.
4. Click **Start** to move it to *In Progress*.
5. As you work, use **Log Hours** to record time spent.
6. When finished, move the task to **Review** — your manager will approve it.
7. Upload any related files under **Documents**.
8. **Clock Out** before you leave.

---

### 5.2 Manager — typical day

```
Morning          →  Check Dashboard review queue
                 →  Scan team activity (who clocked in, open tasks)
During the day   →  Create/assign work orders
                 →  Approve reviewed tasks → Done
                 →  Monitor Kanban board
End of week      →  Run Weekly Time report
```

**Step-by-step:**

1. Open **Dashboard** — check **Needs your approval** first.
2. Click **Review** on any item in the review queue → open the work order → set status to **Done** or send back to **In Progress**.
3. Use the **Team activity** table for standup: who logged time today? Who has too many open tasks?
4. Create new work orders: **Work Orders** → **New Tactic** → fill in title, assignee, priority, due date, project.
5. Use **Kanban Board** for a visual overview — drag cards between columns.
6. Check **Team Time** for hours logged by your team.
7. Send team updates via **Announcements** → **Send**.

---

### 5.3 Admin — typical day

Admins do everything managers can do, plus:

- Create and manage **Companies**
- Create **Employees** and assign roles
- Configure **Teams** and org hierarchy under **Admin Settings**
- View organisation-wide stats on the Dashboard
- Access all reports and all team time

**Morning check:**

1. Scan **Overdue** count on Dashboard.
2. Review **Overdue employees** list → click through to employee profiles.
3. Check **Company hours chart** for utilisation trends.
4. Use **Activity Log** to audit recent changes.

---

### 5.4 Director — typical day

Directors see organisation-wide dashboards and can work on their own assigned tasks. They generally have read-focused access: they can view work orders, documents, and activity but cannot create employees, approve reviews, or run reports.

---

## 6. Feature Guides

### 6.1 Dashboard

**Path:** Sidebar → **Dashboard**

Your home screen. Content varies by role.

#### Employee Dashboard

| Widget | Purpose |
|--------|---------|
| Clock widget | Clock in / clock out |
| Today / This week hours | Your logged time |
| Completed (30 days) | Tasks you finished recently |
| Overdue count | Tasks past their due date |
| Task sections | Overdue → Due today → Due this week |
| Quick links | Jump to My Time or all your tasks |

#### Manager Dashboard

| Widget | Purpose |
|--------|---------|
| Clock widget | Clock in / clock out (your own time) |
| Team size | Active members on your team |
| Open / In Progress / Overdue | Team workload snapshot |
| Needs your approval | Tasks waiting for your sign-off |
| Team hours chart | Last 7 days of team time |
| Team activity table | Per-person: today's hours, week hours, open tasks |

#### Admin / Director Dashboard

| Widget | Purpose |
|--------|---------|
| Clock widget | Clock in / clock out (your own time) |
| Companies / Employees / Active projects | Organisation size |
| Open / In Progress / Overdue | Org-wide work order counts |
| Completion chart | Tasks completed per day (last 30 days) |
| Company hours chart | Hours logged across the org (last 7 days) |
| Overdue employees | Top assignees with overdue tasks |

---

### 6.2 My Work

**Path:** Sidebar → **My Work**

Your personal workspace for spreadsheets, imported files, and rich-text documents. This is separate from company **Documents** (which are linked to work orders/projects).

#### What you can create

| Type | How to create | Best for |
|------|---------------|----------|
| **Blank spreadsheet** | Click **+** → New spreadsheet | Tracking lists, calculations |
| **Rich-text document** | Click **+** → New document | Notes, formatted write-ups |
| **Import Excel** | Click **+** → Upload Excel | Bring in `.xlsx` files |
| **Import Word/PDF** | Click **+** → Upload document | Import `.docx` or other files |

#### Spreadsheet editing (Excel-like)

| Action | How |
|--------|-----|
| Edit a cell | Click the cell and type |
| Rename a column | **Double-click** the column header, type the new name, press Enter |
| Delete a column | Hover the column header → click **×** (at least one column must remain) |
| Add a column | Toolbar → **Column** |
| Add a row | Toolbar → **Row** |
| Delete a row | Hover the row number (**#**) → click the trash icon |
| Resize a column | Drag the right edge of the column header |
| Resize a row | Drag the bottom edge of the row number (**#**) cell |
| Wrap text | Toolbar → **Wrap** |
| Save changes | Toolbar → **Save** |

#### Organising with folders

1. Click **New folder** in the left panel.
2. Name the folder.
3. Drag sheets into folders using the move dropdown on each item.
4. Expand/collapse folders with the arrow icon.
5. **Rename a folder:** Hover the folder → click the pencil icon.
6. **Rename a file:** Hover the file in the sidebar → click the pencil icon.

#### Sharing

- **Share a single sheet:** Open the sheet → click the **Share** (users) icon → select colleagues who can view or edit.
- **Share a folder:** Click the folder menu → **Share folder** → everyone you add gets access to all sheets inside.

Shared items appear under **Shared with me** in the left panel.

#### Linking to a work order

Inside a document, you can create a **personal work order** from selected text — useful when notes turn into actionable tasks.

#### Tips

- Sheets auto-save as you edit.
- Only the owner can delete a sheet or folder.
- Shared users see a small **users** icon next to shared items.

---

### 6.3 TACTIC Documents

**Path:** Sidebar → **TACTICs**

TACTIC documents capture structured meeting outputs: purpose, attendees, decisions, tasks, and next steps.

> **TACTIC** = structured meeting document (not the same as a Work Order / tactic task).

#### Creating a TACTIC document

1. Click **New TACTIC**.
2. Fill in meeting details: date, time, facilitator, location, attendees.
3. Enter **Purpose** and optional background information.
4. Add **Tasks** — title, description, assignee, target date, status.
5. Add **Next Steps** — description, owner, due date.
6. Link to a **Company** and/or **Project** if applicable.
7. Save as **Draft** or **Submit** for review.

#### TACTIC status flow

```
Draft → Submitted → Reviewed → Approved
                    ↓
              Revision Needed → (edit and resubmit)
```

| Status | Meaning |
|--------|---------|
| Draft | Still being written |
| Submitted | Sent to reviewer |
| Reviewed | Reviewer has looked at it |
| Approved | Finalised |
| Revision Needed | Reviewer requested changes |

#### Who can create TACTICs?

Admins, managers, and employees can create TACTIC documents. Managers and admins typically review and approve them.

---

### 6.4 Work Orders

**Path:** Sidebar → **Work Orders**

Work orders (also called **tactics**) are the main unit of assigned work. Each gets an auto-generated code: `TAC001`, `TAC002`, etc.

#### Viewing work orders

The list shows all work orders you have access to (filtered automatically by your role).

| Column | Meaning |
|--------|---------|
| Code | Unique ID (e.g. TAC001) |
| Title | Short description of the work |
| Assignee | Who is responsible |
| Status | Current stage in the workflow |
| Priority | Low, Medium, High, or Critical |
| Due date | Deadline |

Click any row to open the **detail page**.

#### Creating a work order (Admin / Manager)

1. Click **New Tactic**.
2. Fill in:
   - **Title** — clear, actionable description
   - **Assignee** — who will do the work
   - **Priority** — low / medium / high / critical
   - **Due date**
   - **Project** (optional)
   - **Estimated hours** (optional)
3. Click **Create**.

#### Working on a work order (Assignee)

1. Open the work order detail page.
2. Click **Start** → status moves to *In Progress*.
3. Click **Log Hours** to record time spent (separate from clock in/out).
4. When complete, click **Submit for Review**.

#### Work order detail page

| Section | What it shows |
|---------|---------------|
| Status buttons | Move to the next allowed status |
| Details | Priority, due date, project, estimated vs logged hours |
| Activity timeline | History of status changes and hours logged |
| Documents | Files linked to this work order |

---

### 6.5 Kanban Board

**Path:** Sidebar → **Kanban Board**

A visual board with four columns:

| Column | Status |
|--------|--------|
| Assigned | Not yet started |
| In Progress | Currently being worked on |
| Review | Waiting for manager approval |
| Done | Completed |

#### How to use

1. **Drag and drop** cards between columns to change status.
2. Click a card to open the full work order detail.
3. Changes from other team members appear **live** — no need to refresh.

> Status changes follow the same rules as the work order detail page. For example, employees cannot drag a card directly to *Done* — it must go through *Review* first.

---

### 6.6 Time Tracking

#### My Time

**Path:** Sidebar → **My Time**

| Action | How |
|--------|-----|
| Clock in | Click **Clock In** on the widget |
| Clock out | Click **Clock Out** on the widget |
| View history | Scroll through the session table below |
| Weekly chart | Bar chart showing hours per day this week |

**Rules:**

- You can only have **one open session** at a time.
- Always clock out at the end of your work day.
- Logging hours on a work order is **separate** from clock in/out (work order hours = time on a specific task; clock = your work day).

#### Team Time (Admin / Manager)

**Path:** Sidebar → **Team Time**

- See a summary of all team members' hours.
- Click an employee's name to view their full log and chart.
- Admins can **correct** entries (adjust clock-in or clock-out times) if someone forgot to clock out.

---

### 6.7 Documents

**Path:** Sidebar → **Documents**

Upload and manage files linked to work orders, projects, or clients.

#### Uploading a file

1. Click **Upload**.
2. Select the file (max 50 MB).
3. Choose what to link it to: work order, project, or client.
4. Click **Upload**.

#### Other actions

| Action | How |
|--------|-----|
| Search / filter | Use the filters at the top |
| Download | Click the download icon (generates a temporary secure link) |
| Delete | Available to admin, director, or the person who uploaded the file |

---

### 6.8 Announcements

**Path:** Sidebar → **Announcements**

#### For all users (Feed tab)

- Read company announcements sent to you.
- Announcements also appear as in-app notifications.

#### For Admin / Manager (Send tab)

1. Go to **Announcements** → **Send**.
2. Write a **subject** and **message**.
3. Select **recipients** (individuals or groups).
4. Choose to send via **in-app notification** and/or **email** (BCC).
5. Click **Send**, or save as **Draft** to finish later.

#### Sent tab

View announcements you have previously sent.

---

### 6.9 Notifications

**Path:** Top bar bell icon, or Sidebar → **Notifications**

WSSO sends notifications for events such as:

- A work order assigned to you
- Status changes on your tasks
- New announcements
- TACTIC document updates

| Action | How |
|--------|-----|
| View all | Click the bell or go to Notifications page |
| Mark one as read | Click the notification |
| Mark all as read | Click **Mark all read** |

The red badge on the bell shows your unread count.

---

### 6.10 Reports (Admin / Manager)

**Path:** Sidebar → **Reports**

Five report types are available in the left panel:

| Report | What it shows | Key filters |
|--------|---------------|-------------|
| **Daily Time** | Hours per employee for one day | Date |
| **Weekly Time** | Daily breakdown per employee for a week | Week start date |
| **Employee Performance** | Assigned, completed, overdue, avg completion days | Date range |
| **Project Progress** | Tasks done vs total, estimated vs logged hours | Project (optional) |
| **Work Orders** | Filtered list for print/export | Status, priority, assignee, project, dates |

**To print:** Use your browser's print function (Ctrl+P / Cmd+P). The report layout hides the sidebar automatically.

> Managers see data for their team only. Admins see the full organisation.

---

### 6.11 Activity Log

**Path:** Sidebar → **Activity Log**

A searchable audit trail of work order and system activity.

#### Filters

| Filter | Options |
|--------|---------|
| Date range | From / To (default: last 7 days) |
| Employee | Filter by who performed the action *(admin/manager/director)* |
| Action type | Created, Updated, Status change, Hours logged, System |

#### What you see by role

| Role | Scope |
|------|-------|
| Admin / Director | Entire organisation |
| Manager | Their team |
| Employee | Their own activity |

Click a work order code in the log to jump to that work order's detail page.

---

### 6.12 Organization (Admin / Manager)

#### Employees (Admin / Manager)

**Path:** Sidebar → **Employees**

| Action | Who | Steps |
|--------|-----|-------|
| View list | Admin (all), Manager (team) | Browse or search the table |
| Create employee | Admin | **Create** → fill name, email, role, team, companies → temp password emailed |
| View profile | Admin, Manager | Click a row |
| Edit | Admin, Manager | Change name, role, team, companies |
| Deactivate | Admin, Manager | Set status to inactive — blocks login |

> New employees receive a set-password email. They must set their password before signing in.

#### Companies (Admin only)

**Path:** Sidebar → **Companies**

- Create, edit, and delete companies.
- Auto-generated codes: `TLB001`, `TLB002`, etc.

#### Projects (Admin / Manager)

**Path:** Sidebar → **Projects**

- Create projects linked to a company and client.
- Assign a project manager.
- Auto-generated codes: `PRJ001`, `PRJ002`, etc.
- Click a project to see linked work orders.
- To close a project, set its status to **Completed** or **Cancelled** (projects cannot be deleted).

#### Clients (Admin / Manager)

**Path:** Sidebar → **Clients**

- Add and edit clients linked to a company.
- Auto-generated codes: `CLI001`, `CLI002`, etc.

#### Admin Settings — Teams & Hierarchy (Admin only)

**Path:** Sidebar → **Admin Settings**

| Tab | Purpose |
|-----|---------|
| **Teams** | Create, edit, and delete teams within companies |
| **Org Assignment** | Assign employees to teams, set managers, link companies |

This is where your organisation structure is maintained.

---

## 7. Work Order Lifecycle

Every work order moves through these statuses:

```
     ┌──────────┐     ┌─────────────┐     ┌────────┐     ┌──────┐     ┌──────────┐
     │ Assigned │ ──► │ In Progress │ ──► │ Review │ ──► │ Done │ ──► │ Archived │
     └──────────┘     └─────────────┘     └────────┘     └──────┘     └──────────┘
                            ▲                  │
                            └──────────────────┘
                              (manager sends back)
```

| Status | Who moves it here | What it means |
|--------|-------------------|---------------|
| **Assigned** | Admin / Manager (on create) | Task created, not yet started |
| **In Progress** | Assignee (or manager) | Work has begun |
| **Review** | Assignee | Work is complete, awaiting manager approval |
| **Done** | Admin / Manager | Manager approved the work |
| **Archived** | Admin / Manager | Closed / no longer active |

### Who can change status?

| Transition | Employee | Manager / Admin |
|------------|:--------:|:---------------:|
| Assigned → In Progress | ✅ | ✅ |
| In Progress → Review | ✅ | ✅ |
| Review → Done | ❌ | ✅ |
| Review → In Progress (send back) | ❌ | ✅ |
| Done → Archived | ❌ | ✅ |

---

## 8. Tips & Best Practices

### For everyone

- **Clock in at the start** and **clock out at the end** of every work day.
- Check the **Dashboard** first thing in the morning for overdue items.
- Use clear, descriptive titles when creating work orders or TACTIC documents.
- Upload supporting files to **Documents** so everything stays in one place.
- Check the **notification bell** regularly for new assignments.

### For employees

- Move tasks to **Review** as soon as work is complete — don't wait for your manager to ask.
- **Log hours** on work orders as you go; don't batch everything at the end of the week.
- Use **My Work** for personal notes and planning; use **Work Orders** for assigned company tasks.

### For managers

- Check the **review queue** on your Dashboard every morning.
- Set realistic **due dates** and **priorities** when creating work orders.
- Use the **Kanban board** in team meetings for a quick visual status check.
- Send important updates through **Announcements** so the whole team is informed.

### For admins

- Keep the **org hierarchy** up to date in Admin Settings when people join, leave, or change teams.
- Review the **Activity Log** periodically for audit purposes.
- Deactivate (don't delete) employee accounts when someone leaves the company.

---

## 9. Frequently Asked Questions

**Q: What's the difference between "Work Orders" and "TACTICs" in the sidebar?**

A: **Work Orders** are individual assigned tasks with a lifecycle (assigned → done). **TACTICs** are structured meeting documents that capture multiple tasks, decisions, and next steps from a meeting.

**Q: What's the difference between "My Work" and "Documents"?**

A: **My Work** is your personal workspace (spreadsheets, notes) that you own and can share. **Documents** are files uploaded and linked to company work orders, projects, or clients.

**Q: I clocked in but forgot to clock out. What happens?**

A: Contact your manager or admin. They can correct your time entry under **Team Time**. WSSO also attempts to auto-close sessions open longer than 12 hours.

**Q: Can I mark my own work order as Done?**

A: No. Employees submit work to **Review**. A manager or admin must approve it and set it to **Done**.

**Q: I was invited but can't log in.**

A: Open the **set-password** email first, create your password, then go to the login page. If you still cannot sign in, ask your admin to confirm your account is active.

**Q: Can I delete a work order?**

A: Work orders cannot be deleted. Managers can set the status to **Archived** to close them.

**Q: How do I print a report?**

A: Go to **Reports**, select the report type, set your filters, then use your browser's print function (Ctrl+P on Windows, Cmd+P on Mac).

**Q: Who do I contact for help?**

A: Contact your **team manager** for work-related questions (assignments, approvals, time corrections). Contact your **system administrator** for account issues (login, access, new user setup).

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│  START OF DAY     Clock In → Check Dashboard tasks          │
│  WORK ON TASK     Open work order → Start → Log Hours      │
│  FINISH TASK      Move to Review → wait for manager         │
│  END OF DAY       Clock Out                                 │
│  NEED HELP        Manager (work) · Admin (account/access)   │
└─────────────────────────────────────────────────────────────┘
```

---

*WSSO User Training Guide — for internal use. Contact your administrator for access or account issues.*
