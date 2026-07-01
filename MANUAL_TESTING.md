# WSSO — Manual Testing Checklist

**Platform:** Next.js + Supabase  
**Roles to test:** Admin · Manager · Director · Employee  
**How to use:** Work through each section. Mark `[x]` when passed, `[!]` when failed (add a note).

> **Before you start:** Run both SQL migrations in Supabase SQL Editor in order:
> 1. `supabase/migrations/20260701000003_tactic_documents.sql`
> 2. `supabase/migrations/20260701000004_tactic_documents_extend.sql`

---

## 0 — Pre-Test Setup

Create the following test accounts via Admin before starting:

| Account | Role | Team | Manager |
|---------|------|------|---------|
| `admin@test.com` | Admin | — | — |
| `manager@test.com` | Manager | Team A | — |
| `director@test.com` | Director | — | — |
| `employee1@test.com` | Employee | Team A | manager@test.com |
| `employee2@test.com` | Employee | Team A | manager@test.com |
| `employee3@test.com` | Employee | — | — (no team, no manager) |

Also create:
- 1 Company: "Test Co"
- 1 Project: "Test Project" (linked to Test Co)
- 1 Client: "Test Client"
- Assign all test employees to "Test Co" via employee_companies

---

## 1 — Authentication

### 1.1 Login
- [ ] Valid admin credentials → redirects to `/dashboard`
- [ ] Invalid password → shows error message, does NOT redirect
- [ ] Empty fields → shows validation error
- [ ] No public signup page exists (visiting `/register` or similar → 404 or redirect)

### 1.2 Session
- [ ] Refresh page → stays logged in
- [ ] Close tab, reopen → stays logged in
- [ ] Log out → redirects to `/login`, back button does not re-enter dashboard

### 1.3 Route protection
- [ ] Visiting `/dashboard` while logged out → redirects to `/login`
- [ ] Employee visiting `/companies` → redirected (admin only)
- [ ] Employee visiting `/employees` → redirected (admin/manager only)
- [ ] Director visiting `/reports` → redirected (admin/manager only)

---

## 2 — Admin: Employee Management

Login as **Admin**.

### 2.1 Create employees
- [ ] Open Employees page → "Create employee" button visible
- [ ] Fill form with role = Employee, assign to Team A, set manager → submit
- [ ] Success screen shows employee code (e.g. `EMP001`)
- [ ] Welcome email sent notice appears (or "could not be sent" notice if email not configured)
- [ ] New employee appears in the table immediately

### 2.2 Create manager
- [ ] Create employee with role = Manager, assign to Team A
- [ ] Team dropdown shows available teams
- [ ] Selecting a team auto-fills the "Direct manager" field

### 2.3 Edit employee
- [ ] Click employee row → detail page opens
- [ ] Edit name/department → save → changes reflected
- [ ] Change role → save → RLS scope changes on next login

### 2.4 Deactivate employee
- [ ] Deactivate an employee → status changes to "Inactive"
- [ ] Inactive employee cannot log in (try logging in as them → rejected)
- [ ] Inactive employee's data (work orders, time logs) still visible to Admin

---

## 3 — Admin Settings: Teams & Hierarchy

Login as **Admin** → Admin Settings (bottom of nav).

### 3.1 Create team
- [ ] "New Team" → enter name, select company, select manager → save
- [ ] Team appears in the list with member count = 0
- [ ] Team without a manager shows ⚠ warning

### 3.2 Assign employees to team
- [ ] Edit an employee → set `team_id` to Team A → save
- [ ] Team member count increments on Hierarchy page
- [ ] That employee now appears in Manager's scope (verify in Section 5)

---

## 4 — Admin: Companies, Projects, Clients

Login as **Admin**.

### 4.1 Companies
- [ ] Create company → appears in list with auto-generated code
- [ ] Edit company name → saved
- [ ] Only Admin can see Companies in nav

### 4.2 Projects
- [ ] Create project → link to company → appears in list
- [ ] Mark project active/inactive → status badge updates
- [ ] Manager can see Projects page; Employee cannot

### 4.3 Clients
- [ ] Create client → link to company → appears in list
- [ ] Manager can see Clients page; Employee cannot

---

## 5 — Manager: Scoped Access

Login as **Manager** (manager@test.com).

### 5.1 Employees page
- [ ] Can see ALL employees in the org (not just their team) — read only for other teams
- [ ] Can EDIT employees in their team (Team A)
- [ ] Cannot edit employees outside their team

### 5.2 Work Orders (Tactics)
- [ ] Can see work orders assigned to Team A members
- [ ] Can see work orders they created
- [ ] CANNOT see work orders assigned to employees outside their team
- [ ] "New Work Order" button works → can assign to Team A employees

### 5.3 Team Time
- [ ] Can see time logs for Team A members
- [ ] CANNOT see time logs for employees outside Team A

### 5.4 Activity Log
- [ ] Can see activity from Team A members only

### 5.5 Hidden nav items
- [ ] Companies page is NOT in nav
- [ ] Admin Settings is NOT in nav
- [ ] Reports IS visible

---

## 6 — Director: Read-Only Access

Login as **Director** (director@test.com).

- [ ] Dashboard visible
- [ ] Work Orders visible (read only — no "New Work Order" button)
- [ ] TACTICs visible (read only)
- [ ] Kanban visible
- [ ] Activity Log visible
- [ ] My Time visible
- [ ] Documents visible
- [ ] **Employees page NOT in nav**
- [ ] **Companies NOT in nav**
- [ ] **Projects NOT in nav**
- [ ] **Reports NOT in nav**
- [ ] **Admin Settings NOT in nav**
- [ ] Attempting to navigate to `/employees` directly → redirected

---

## 7 — Work Orders (Tactics)

Login as **Admin** first.

### 7.1 Create
- [ ] "New Work Order" → fill title, assign to employee, set due date → create
- [ ] Appears in list with status "Open"
- [ ] Kanban card appears in correct column

### 7.2 Edit & Status
- [ ] Open work order → Edit → change title → save → updated
- [ ] Change status (Open → In Progress → Done) → Kanban column changes

### 7.3 Archive
- [ ] Archive a work order → detail page shows "This work order has been archived."
- [ ] Archived orders hidden from Kanban by default

### 7.4 Activity timeline
- [ ] Creating a work order logs "Work order created" (not "Tactic created")
- [ ] Editing a work order logs "Work order updated"

---

## 8 — TACTIC Documents (Main New Feature)

> Run migrations 003 and 004 before testing this section.

### 8.1 Navigation
- [ ] "TACTICs" appears in nav above "Work Orders" for all roles
- [ ] Director sees TACTICs (read only)
- [ ] Employee sees TACTICs

### 8.2 Create — as Employee (employee1@test.com)

- [ ] "New TACTIC" button visible
- [ ] Form loads with 6 sections: Meeting Details, TACTIC Tasks, Background Info, Takeaways, Next Steps, Linking
- [ ] Fill Meeting Details: date, time, facilitator, location, attendees
- [ ] Add 2 TACTIC Tasks: title, status, owner name, target date
- [ ] Reorder tasks with ↑/↓ buttons → order changes
- [ ] Remove a task → row disappears
- [ ] Fill Background Info and Takeaways
- [ ] Add 2 Next Steps with owner and due date
- [ ] Link to a Company and Project (optional)
- [ ] **"Save as Draft"** → saves, redirects to detail page, status = Draft
- [ ] Auto-generated code appears (e.g. `TDOC001`)

### 8.3 Submit for Review — as Employee

- [ ] On draft detail page → "Submit for Review" button visible
- [ ] Click → status changes to **Submitted**
- [ ] "Submit for Review" button disappears
- [ ] Manager (manager@test.com) receives a notification: "employee1 submitted a TACTIC for your review: TDOC001"

### 8.4 Review — as Manager

Login as **Manager**.

- [ ] TACTIC list shows employee1's submitted doc (status = Submitted)
- [ ] Open it → Review panel visible at top with "Approve" and "Request Revision" buttons
- [ ] Employee1's docs are visible; docs from other companies' employees are NOT

#### 8.4a Approve
- [ ] Click "Approve" → status changes to **Approved**
- [ ] Review panel disappears
- [ ] Review timeline in sidebar shows "Approved" with timestamp
- [ ] Employee1 receives notification: "Your TACTIC TDOC001 has been approved."

#### 8.4b Request Revision
- [ ] Create a second TACTIC as employee → submit
- [ ] Manager clicks "Request Revision" → modal opens
- [ ] Enter revision note → submit
- [ ] Status changes to **Revision Needed**
- [ ] Amber revision banner appears on detail page with the note
- [ ] Employee1 receives notification with the note

### 8.5 Re-submit after revision — as Employee

- [ ] Open revision_needed doc → "Edit" button visible
- [ ] Edit page shows amber warning banner
- [ ] Make changes → "Save & Re-submit" button → submits
- [ ] Status back to **Submitted**
- [ ] Manager receives notification again

### 8.6 Admin auto-approval

Login as **Admin**.

- [ ] Create a TACTIC → "Submit for Review" → status immediately goes to **Approved** (no review needed)
- [ ] No notification sent

### 8.7 Manager creates TACTIC — reviewed by Admin

Login as **Manager**.

- [ ] Create TACTIC → submit for review
- [ ] Status = Submitted
- [ ] Admin (admin@test.com) receives notification

Login as **Admin**.

- [ ] Can see the manager's submitted TACTIC
- [ ] Review panel visible → Approve → status = Approved
- [ ] Manager receives approval notification

### 8.8 Delete
- [ ] Employee can delete their own Draft TACTIC → gone from list, redirected
- [ ] Employee CANNOT delete a Submitted or Approved TACTIC (button not shown)
- [ ] Admin can delete any Draft TACTIC

### 8.9 Filters on list page
- [ ] Filter by status → list updates
- [ ] Filter by meeting date range → list updates
- [ ] "Created by" filter visible for Admin/Manager, hidden for Employee
- [ ] Row count shown at bottom (e.g. "3 of 12 documents")

### 8.10 Director access
- [ ] Director can see the TACTIC list
- [ ] No "New TACTIC" button
- [ ] Can open detail page (read only)
- [ ] No Review panel, no Edit button

---

## 9 — Dashboard Stat Cards

### 9.1 Admin Dashboard
- [ ] All stat cards load without error
- [ ] "TACTICs pending" card shows count of submitted (unreviewed) docs
- [ ] When count > 0, card shows warning (amber) variant
- [ ] When count = 0, card shows default variant
- [ ] Clicking the card (if linked) navigates to TACTIC list filtered by submitted

### 9.2 Manager Dashboard
- [ ] "TACTICs pending" card shows count of submitted docs from their company
- [ ] Warning variant when count > 0

---

## 10 — Time Logs

Login as **Employee**.

### 10.1 My Time
- [ ] Clock In → timer starts
- [ ] Clock Out → log entry appears with duration
- [ ] Cannot clock in twice without clocking out

Login as **Manager**.

### 10.2 Team Time
- [ ] Shows all time logs for Team A members
- [ ] Can edit/correct a team member's log
- [ ] Cannot see time logs for employees outside Team A

---

## 11 — Documents

### 11.1 Upload
- [ ] Employee uploads a document → appears in their list
- [ ] Manager can see documents uploaded by Team A members
- [ ] Director can see all documents (read only)

---

## 12 — Reports

Login as **Admin** or **Manager**.

- [ ] Reports page loads
- [ ] Employee performance report shows team data
- [ ] Work order progress filter works ("Filtered work order list...")
- [ ] Director cannot access `/reports` (redirected)

---

## 13 — Activity Log

### 13.1 Rename check
- [ ] Activity log shows "Work order created" (NOT "Tactic created")
- [ ] Activity log shows "Work order updated" (NOT "Tactic updated")
- [ ] Filter dropdown shows "Work order created" and "Work order updated" options

### 13.2 Scope
- [ ] Admin sees ALL activity
- [ ] Manager sees only Team A members' activity
- [ ] Employee sees only their own activity

---

## 14 — Notifications

- [ ] Bell icon in nav shows unread count badge
- [ ] Clicking bell → notifications page
- [ ] Notifications appear for: TACTIC submitted (reviewer), TACTIC approved (creator), revision requested (creator)
- [ ] Marking notification as read → badge count decrements

---

## 15 — Nav Label Check (Rename Audit)

Visit each page and confirm all labels say "Work Order" (not "Tactic"):

- [ ] `/tactics` page title/heading
- [ ] `/tactics/[id]` breadcrumb says "Work Orders"
- [ ] "New Work Order" button on list page
- [ ] TacticDialog title says "New work order" / "Edit work order"
- [ ] Archive message: "This work order has been archived."
- [ ] Reports shell placeholder text mentions "work orders"
- [ ] Activity log page description mentions "Work order"
- [ ] Nav shows "Work Orders" (not "Tactics")
- [ ] Nav shows "TACTICs" as a separate item above "Work Orders"

---

## 16 — Edge Cases

- [ ] Create TACTIC with no tasks and no next steps → saves without error
- [ ] Create TACTIC with 10+ tasks → all saved and displayed in order
- [ ] Submit TACTIC when employee has no `manager_id` set → no crash (notification silently skipped)
- [ ] Open a TACTIC detail page with an invalid UUID in URL → 404 or redirect (no crash)
- [ ] Deactivate an employee who has submitted TACTICs → their TACTICs still visible to Admin
- [ ] Two managers from different companies: Manager A cannot see Manager B's employees' TACTICs

---

## Sign-off

| Section | Status | Notes |
|---------|--------|-------|
| 1. Authentication | | |
| 2. Employee Management | | |
| 3. Teams & Hierarchy | | |
| 4. Companies / Projects / Clients | | |
| 5. Manager Scoped Access | | |
| 6. Director Read-Only | | |
| 7. Work Orders | | |
| 8. TACTIC Documents | | |
| 9. Dashboard Stats | | |
| 10. Time Logs | | |
| 11. Documents | | |
| 12. Reports | | |
| 13. Activity Log | | |
| 14. Notifications | | |
| 15. Nav Labels | | |
| 16. Edge Cases | | |

**Tested by:** _______________  
**Date:** _______________  
**Build:** _______________
