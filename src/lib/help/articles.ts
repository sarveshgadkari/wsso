import type { HelpArticle } from './types'

export const HELP_ARTICLES: HelpArticle[] = [
  // ── Always-on role overviews (chat context only) ──────────────────────────
  {
    id: 'overview-employee',
    path: '',
    title: 'WSSO for you',
    roles: ['employee'],
    alwaysInContext: true,
    summary: 'Your WSSO account is for your own work, time, leave, and training.',
    youAreHere: 'You are using WSSO as an employee.',
    steps: [
      'Open Dashboard to clock in and see work assigned to you.',
      'Use My Time and My Leave for your own hours and time off.',
      'Open Work Orders for tasks assigned to you.',
      'Ask this help chat only about pages in your sidebar.',
    ],
    suggestedQuestions: [
      'How do I clock in?',
      'How do I request leave?',
      'Where are my work orders?',
    ],
    body:
      'You are an employee in WSSO. You only see your own dashboard, work, time, leave, training, and similar personal pages. ' +
      'You cannot access admin pages such as Workspace settings, Subscription, Companies, CRM, Employees, Team Time, Team Leave, Approvals, Reports, or Licenses. ' +
      'If asked how to approve leave, add a company, change billing, manage other employees, or run payroll, refuse and say those are admin or manager features. ' +
      'Tell the user to ask their manager or workspace admin, and offer help with their own pages instead.',
  },
  {
    id: 'overview-director',
    path: '',
    title: 'WSSO for directors',
    roles: ['director'],
    alwaysInContext: true,
    summary: 'Directors see a leadership dashboard plus their own work pages, not admin setup.',
    youAreHere: 'You are using WSSO as a director.',
    steps: [
      'Dashboard shows workspace snapshot cards.',
      'Use Work Orders, My Time, and My Leave like other staff.',
      'Workspace billing, companies, and CRM stay with the admin.',
    ],
    suggestedQuestions: [
      'What is on my dashboard?',
      'How do I clock in?',
      'Where are work orders?',
    ],
    body:
      'You are a director in WSSO. You get a leadership-style dashboard plus personal work pages (work orders, time, leave, training). ' +
      'You cannot open admin-only pages: Companies, CRM, Subscription, Workspace settings. ' +
      'You also cannot open manager team pages: Employees, Projects, Clients, Team Time, Team Leave, Approvals, Reports, Licenses. ' +
      'Do not teach those workflows. Point the user to the workspace admin or a manager.',
  },
  {
    id: 'overview-manager',
    path: '',
    title: 'WSSO for managers',
    roles: ['manager'],
    alwaysInContext: true,
    summary: 'Managers run their team: work orders, time, leave, and approvals — not billing or companies.',
    youAreHere: 'You are using WSSO as a manager.',
    steps: [
      'Use Team Time, Team Leave, and Approvals for your people.',
      'Create and assign work orders for your team.',
      'Employees, Projects, Clients, and Reports are available for your scope.',
      'Companies, CRM, Subscription, and Workspace settings are admin-only.',
    ],
    suggestedQuestions: [
      'How do I approve leave?',
      'How do I assign a work order?',
      'Where is team time?',
    ],
    body:
      'You are a manager in WSSO. You can help with your team: Employees (your people), Projects, Clients, Work Orders, Team Time, Team Leave, Approvals, Reports, Licenses, plus your own My Time / My Leave. ' +
      'You cannot access Companies, the full CRM, Subscription, or Workspace settings. Those are admin-only. ' +
      'If asked how to change the plan, add a company, or edit workspace features, refuse and tell them to ask the workspace admin.',
  },
  {
    id: 'overview-admin',
    path: '',
    title: 'WSSO for admins',
    roles: ['admin'],
    alwaysInContext: true,
    summary: 'Admins can ask about every WSSO screen, including billing and workspace setup.',
    youAreHere: 'You are using WSSO as a workspace admin.',
    steps: [
      'Use Workspace to turn features on or off.',
      'Use Subscription for plan and payment.',
      'Use Employees, Companies, CRM, and Reports to run the workspace.',
      'You may also ask how employees and managers use their pages.',
    ],
    suggestedQuestions: [
      'How do I add an employee?',
      'How do I turn features on?',
      'How does leave approval work?',
    ],
    body:
      'You are a workspace admin. You may receive help for every WSSO tab: dashboard, work, organization, CRM, time, leave, approvals, training, documents, reports, billing, and workspace settings. ' +
      'You may also learn employee and manager flows so you can train your team. ' +
      'Still refuse non-WSSO topics (weather, general knowledge, unrelated products, writing code, medical/legal advice). ' +
      'Do not invent buttons. If a step is not in the articles, say you are not sure and describe the closest matching page.',
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  {
    id: 'dashboard-employee',
    path: '/dashboard',
    title: 'Dashboard',
    roles: ['employee'],
    summary: 'Your home screen: clock, today’s work, and shortcuts.',
    youAreHere: 'You are on your employee dashboard — a snapshot of your day, not the admin workspace.',
    steps: [
      'Clock in from the time widget if you are starting work. Your workspace may require a note.',
      'Review work orders assigned to you (overdue items are highlighted).',
      'Check My Work and Training cards if those features are on.',
      'Use the sidebar to open My Time, My Leave, Work Orders, and other pages you can access.',
    ],
    tips: [
      'You will not see team-wide reports, billing, or other people’s timesheets here.',
      'Clock out from the same widget when you finish.',
    ],
    suggestedQuestions: [
      'How do I clock in from the dashboard?',
      'Where do I see tasks assigned to me?',
      'How do I request time off?',
    ],
    body:
      'Employee dashboard. Clock in/out with the clock widget (notes may be required). Lists your work orders, hours, leave, My Work, and training progress. ' +
      'Does not show other employees, payroll, companies, CRM admin, approvals inbox, or subscription. ' +
      'To see hours history open My Time. To request leave open My Leave. To open a task, click it or go to Work Orders.',
  },
  {
    id: 'dashboard-manager',
    path: '/dashboard',
    title: 'Dashboard',
    roles: ['manager'],
    summary: 'Team snapshot plus your own clock widget.',
    youAreHere: 'You are on the manager dashboard — your team’s work at a glance.',
    steps: [
      'Use the clock widget for your own day.',
      'Scan open work, overdue items, and team activity.',
      'Open Team Time, Team Leave, or Approvals from the sidebar when something needs a decision.',
      'Jump into Work Orders to assign or follow up.',
    ],
    suggestedQuestions: [
      'What should I check first each morning?',
      'Where do I approve leave?',
      'How do I see who is working?',
    ],
    body:
      'Manager dashboard. Shows your clock plus team-oriented cards (open work, overdue work orders, training, announcements depending on features). ' +
      'Use Team Time for timesheets, Team Leave / Approvals for requests, Work Orders to assign jobs. ' +
      'You cannot open Subscription or Workspace settings — ask the admin for billing and feature flags.',
  },
  {
    id: 'dashboard-director',
    path: '/dashboard',
    title: 'Dashboard',
    roles: ['director'],
    summary: 'Leadership snapshot of the workspace.',
    youAreHere: 'You are on the director dashboard — high-level workspace stats.',
    steps: [
      'Review counts and charts for a workspace snapshot.',
      'Use your own clock widget if you track time.',
      'Open Work Orders, My Time, or other sidebar pages for details you are allowed to see.',
      'Ask the admin for billing, companies, or CRM changes — those pages are not in your sidebar.',
    ],
    suggestedQuestions: [
      'What do the dashboard cards mean?',
      'How do I open my work orders?',
      'Can I change workspace settings?',
    ],
    body:
      'Director dashboard is a leadership overview. You may see workspace-level stats. ' +
      'You still cannot open admin setup (Companies, CRM, Subscription, Workspace) or manager team tools (Employees, Team Time, Approvals, Reports). ' +
      'If a card looks like an admin tool, explain that changing those settings requires the workspace admin.',
  },
  {
    id: 'dashboard-admin',
    path: '/dashboard',
    title: 'Dashboard',
    roles: ['admin'],
    summary: 'Workspace command center: people, jobs, time, CRM, and billing status.',
    youAreHere: 'You are on the admin dashboard for this workspace.',
    steps: [
      'Check subscription status if a billing card is shown.',
      'Use stat cards to jump into Employees, Companies, Projects, and open work orders.',
      'Review Who is working, overdue follow-ups, and expiring licenses when those features are on.',
      'Clock in yourself from the widget if you track time.',
      'Open Workspace to toggle features; Subscription to manage the plan.',
    ],
    suggestedQuestions: [
      'How do I add my first employee?',
      'Where do I turn CRM on?',
      'How do I see who is clocked in?',
    ],
    body:
      'Admin dashboard. Workspace stats (companies, employees, projects, open/in-progress work orders), time charts, tactic completion, announcements, training, CRM, who-is-working, ops strip (pending leave, follow-ups, licenses). ' +
      'Subscription card appears when relevant. Use sidebar: Employees to invite people, Companies for entities, CRM for leads, Work Orders for jobs, Reports for exports, Workspace for feature flags, Subscription for Stripe plan.',
  },

  // ── Work ──────────────────────────────────────────────────────────────────
  {
    id: 'my-work',
    path: '/my-work',
    title: 'My Work',
    feature: 'myWork',
    summary: 'Personal sheets and Notion-style pages, optionally linked to work orders.',
    youAreHere: 'You are on My Work — your personal notebooks and spreadsheets.',
    steps: [
      'Create a folder if you want to group pages.',
      'Upload Excel to get an editable table, or create a blank page for notes and tasks.',
      'Link a sheet or row to a work order when the work belongs to a job.',
      'Share a folder if your workspace allows collaboration on that sheet.',
    ],
    suggestedQuestions: [
      'How do I upload an Excel file?',
      'How do I link a sheet to a work order?',
      'What is the difference between a table and a page?',
    ],
    body:
      'My Work is personal workspace: upload Excel (grid) or create a document page (notes, tasks). You can organize items in folders and link rows to work orders. ' +
      'This is not the Work Orders list and not admin document libraries. Each person sees their own sheets unless a folder is shared.',
  },
  {
    id: 'tactic-documents',
    path: '/tactic-documents',
    title: 'TACTICs',
    summary: 'Planning documents with tasks and next steps, then approval.',
    youAreHere: 'You are on TACTICs — written plans (not the Work Orders job list).',
    steps: [
      'Open New to start a TACTIC document with title, tasks, and next steps.',
      'Employees typically submit for review; managers/admins approve or send back.',
      'Use share options if you need someone else to view or edit.',
      'This list is separate from Work Orders (/tactics), which are day-to-day jobs.',
    ],
    suggestedQuestions: [
      'How do I create a TACTIC document?',
      'Who approves a TACTIC?',
      'What is the difference between TACTICs and Work Orders?',
    ],
    body:
      'TACTIC documents are structured plans (tasks, next steps, status, sharing). Employees create drafts and submit. Managers/admins review, approve, or request changes. ' +
      'Work Orders (sidebar label Work Orders, URL /tactics) are assignable jobs with time and status. Do not mix up the two. ' +
      'Employees should not be told they can approve everyone else’s documents unless they are a manager or admin.',
  },
  {
    id: 'work-orders-employee',
    path: '/tactics',
    title: 'Work Orders',
    roles: ['employee', 'director'],
    summary: 'Jobs assigned to you. Overdue rows are highlighted.',
    youAreHere: 'You are on Work Orders — tasks assigned to you, not the whole company board.',
    steps: [
      'Open a row to see details, checklist, and updates.',
      'Update status as you work (for example in progress, then review/done as your process allows).',
      'Log time against the job if your workspace uses the time clock.',
      'You generally cannot reassign work to the whole company; ask your manager if a job is wrong.',
    ],
    tips: ['Overdue work orders are highlighted. Kanban is another view of the same jobs if that feature is on.'],
    suggestedQuestions: [
      'How do I update a work order status?',
      'Where do I see overdue jobs?',
      'Can I assign a job to someone else?',
    ],
    body:
      'Employee/director Work Orders list: jobs assigned to you (codes like TAC001). Open a job for checklist, comments, and details. ' +
      'You cannot run the company-wide assign board like an admin. Do not explain how to create jobs for other people, edit all employees, or open Team Time. ' +
      'If they need a new job created for someone else, tell them to ask a manager or admin.',
  },
  {
    id: 'work-orders-staff',
    path: '/tactics',
    title: 'Work Orders',
    roles: ['admin', 'manager'],
    summary: 'Create, assign, and track jobs. Codes are auto-generated (TAC001…).',
    youAreHere: 'You are on Work Orders — create and assign jobs for the workspace or your team.',
    steps: [
      'Click to create a work order: title, assignee, project, due date, priority, checklist if required.',
      'Admins see all workspace jobs. Managers see jobs they created or assigned to their team.',
      'Open a job for checklist, time/costing (if enabled), and activity.',
      'Use Kanban for a board view of the same records.',
    ],
    suggestedQuestions: [
      'How do I create a work order?',
      'How do I assign a job to my team?',
      'What do the TAC codes mean?',
    ],
    body:
      'Admins see all work orders. Managers see team-scoped jobs. Creating a job auto-generates a code (TAC001…). ' +
      'Assign an employee, optional project, due date, priority, SLA, billable flag, checklist. Job costing uses hours × rate when enabled. ' +
      'Recurring jobs and custom fields may appear based on Workspace feature flags.',
  },
  {
    id: 'kanban',
    path: '/kanban',
    title: 'Kanban Board',
    feature: 'kanban',
    summary: 'Board view of work orders by status. Drag cards to update.',
    youAreHere: 'You are on the Kanban board — the same work orders as the list, shown as columns.',
    steps: [
      'Each column is a status (assigned, in progress, review, done, and similar).',
      'Drag a card to another column to change status if you are allowed to update that job.',
      'Click a card to open the full work order.',
      'Employees typically only move their own jobs; managers and admins have wider access.',
    ],
    suggestedQuestions: [
      'How do I move a card?',
      'Is Kanban different from Work Orders?',
      'Why can I not see every card?',
    ],
    body:
      'Kanban is a board of work orders. It does not create a second data set. Employees usually see their assignments. Managers/admins see team or workspace jobs. Drag to change status. Use Work Orders list for filters and create.',
  },

  // ── Organization (restricted) ─────────────────────────────────────────────
  {
    id: 'employees',
    path: '/employees',
    title: 'Employees',
    roles: ['admin', 'manager'],
    summary: 'People in the workspace: invite, roles, teams, and profiles.',
    youAreHere: 'You are on Employees — people records. Admins manage the whole workspace; managers see their team.',
    steps: [
      'Admin: create an employee, pick a role (director, manager, employee), send the set-password email.',
      'Manager: view and update your team; you cannot create workspace admins or change billing.',
      'Open a person to edit profile, companies, timezone, and activity. Use Delete profile to remove the account.',
      'Inactive people cannot sign in.',
    ],
    suggestedQuestions: [
      'How do I invite a new employee?',
      'What roles can I assign?',
      'How do I deactivate someone?',
      'How do I delete a profile?',
    ],
    body:
      'Employees directory. Admin creates users (director/manager/employee), sends password link, assigns companies/teams. Manager sees team-scoped people. ' +
      'Roles: admin runs the workspace; manager leads a team; employee has personal pages; director has a leadership dashboard without admin setup. ' +
      'Do not tell employees how to use this page — they cannot open it.',
  },
  {
    id: 'companies',
    path: '/companies',
    title: 'Companies',
    roles: ['admin'],
    summary: 'Legal entities or brands in this workspace.',
    youAreHere: 'You are on Companies — admin-only list of entities in the workspace.',
    steps: [
      'Create a company (name and details).',
      'Assign employees to companies from the employee profile.',
      'Use companies when organizing work, CRM, or reporting.',
    ],
    suggestedQuestions: [
      'How do I add a company?',
      'How do employees get linked to a company?',
    ],
    body:
      'Companies are workspace entities (brands, subsidiaries). Admin-only. Employees and managers cannot add companies. Link people via Employees. Not the same as Clients (customers) or CRM leads.',
  },
  {
    id: 'projects',
    path: '/projects',
    title: 'Projects',
    roles: ['admin', 'manager'],
    summary: 'Group work orders under a project with a manager and status.',
    youAreHere: 'You are on Projects — containers for work orders.',
    steps: [
      'Create a project with name, code, optional manager, and status (active, on hold, completed).',
      'Open a project to see related work orders and progress.',
      'Managers typically own or see projects in their scope; admins see all.',
    ],
    suggestedQuestions: [
      'How do I create a project?',
      'How do work orders attach to a project?',
    ],
    body:
      'Projects group work orders. Admin/manager page. Employees do not manage the project list. Attach jobs when creating or editing a work order. Reports can show project progress.',
  },
  {
    id: 'clients',
    path: '/clients',
    title: 'Clients',
    roles: ['admin', 'manager'],
    summary: 'Customer records. Leads can convert into clients from CRM.',
    youAreHere: 'You are on Clients — customer accounts, not CRM leads.',
    steps: [
      'Add a client with name and details.',
      'Convert a won lead from CRM (admin) into a client when a deal closes.',
      'Link work to clients as your process uses them.',
    ],
    suggestedQuestions: [
      'How do I add a client?',
      'How is a client different from a lead?',
    ],
    body:
      'Clients are customers. Admin/manager. CRM leads are prospects; converting a won lead creates or links a client. Employees use My Leads for assigned prospects, not this full directory.',
  },

  // ── CRM ───────────────────────────────────────────────────────────────────
  {
    id: 'crm',
    path: '/crm',
    title: 'CRM',
    roles: ['admin'],
    feature: 'crm',
    summary: 'All leads, CSV import, assignment, and pipeline.',
    youAreHere: 'You are on CRM — admin pipeline for every lead in the workspace.',
    steps: [
      'Add a lead or import CSV.',
      'Assign one or more people so the lead appears on their My Leads page.',
      'Update status, follow-up dates, and win/lost reasons from workspace catalogs.',
      'Convert a won lead to a client when you close it.',
    ],
    suggestedQuestions: [
      'How do I import leads from CSV?',
      'How do I assign a lead to an employee?',
      'How do I convert a lead to a client?',
    ],
    body:
      'Admin CRM: all leads, bulk CSV, assignment, follow-ups, win/lost reasons, convert to client. Employees never get this page — they only get My Leads for assigned records. Website enquiry forms also land here.',
  },
  {
    id: 'my-leads',
    path: '/my-leads',
    title: 'My Leads',
    feature: 'crm',
    summary: 'Leads assigned to you. Update status and follow-ups.',
    youAreHere: 'You are on My Leads — only prospects assigned to you, not the full company CRM.',
    steps: [
      'Open a lead to update status and notes.',
      'Set a follow-up date if your workspace uses follow-ups.',
      'You cannot import all company leads or unassign everyone — that is the admin CRM.',
      'Ask an admin if you need a lead that is not in this list.',
    ],
    suggestedQuestions: [
      'How do I update a lead status?',
      'Why is a lead missing from my list?',
      'Can I add a brand-new lead for the whole company?',
    ],
    body:
      'My Leads shows leads assigned to the signed-in user. Update status and follow-ups. Do not teach CSV import, company-wide assignment, or CRM admin settings to employees. Those live on /crm for admins only.',
  },

  // ── Time ──────────────────────────────────────────────────────────────────
  {
    id: 'my-time',
    path: '/time',
    title: 'My Time',
    feature: 'time',
    summary: 'Your timesheet: clock, daily hours, and recent logs.',
    youAreHere: 'You are on My Time — only your hours, not the team timesheet.',
    steps: [
      'Clock in from the dashboard widget (or follow the same clock control if shown). One open session per day.',
      'Add a note on clock in or out if the workspace requires it.',
      'Clock out when you finish. The day may auto-close at midnight in your timezone.',
      'Read the weekly chart and log table for the last weeks of your own time.',
    ],
    tips: [
      'Approved full-day leave can block clock-in for that date.',
      'Managers review team hours on Team Time, which you cannot open as an employee.',
    ],
    suggestedQuestions: [
      'How do I clock in and out?',
      'Why can I not clock in today?',
      'Where does my manager see my hours?',
    ],
    body:
      'My Time is the current user’s timesheet. Clock in/out, optional notes, timezone-aware logs, weekly chart. Cannot clock in twice the same day after completion. Leave may block the day. ' +
      'Employees must not be instructed to open Team Time, edit others’ logs, or export payroll. Managers/admins do that on Team Time and Reports.',
  },
  {
    id: 'team-time',
    path: '/time/team',
    title: 'Team Time',
    roles: ['admin', 'manager'],
    feature: 'time',
    summary: 'Review hours for your team or the whole workspace.',
    youAreHere: 'You are on Team Time — other people’s timesheets, not your personal My Time page.',
    steps: [
      'Scan who is clocked in and daily/weekly totals.',
      'Open a person for their log detail.',
      'Review pending clock notes if the workspace requires notes.',
      'Use Force clock-out only when a session was left open.',
    ],
    suggestedQuestions: [
      'How do I see who is still clocked in?',
      'How do I review someone’s timesheet?',
      'When should I force clock-out?',
    ],
    body:
      'Team Time: admin sees workspace; manager sees their team. Review hours, notes, open sessions. Force clock-out for abandoned sessions. Not visible to employees. Payroll-style exports live under Reports / ops tools, not on the employee My Time page.',
  },
  {
    id: 'my-leave',
    path: '/leave',
    title: 'My Leave',
    feature: 'leave',
    summary: 'Request time off and track pending, approved, or declined.',
    youAreHere: 'You are on My Leave — your requests only. You cannot approve other people here.',
    steps: [
      'Create a request: dates, optional half-day, and leave type if required.',
      'Wait for a manager or admin to approve or decline.',
      'Watch status on this same list. You cannot approve your own request.',
    ],
    suggestedQuestions: [
      'How do I request leave?',
      'Who approves my leave?',
      'Can I cancel a pending request?',
    ],
    body:
      'My Leave: submit start/end date, optional half-day period, leave type from workspace catalog. Status: pending, approved, declined. ' +
      'Employees cannot approve team leave. If they ask how to approve, refuse and point them to their manager. Approvals happen on Team Leave or Approvals for managers/admins.',
  },
  {
    id: 'team-leave',
    path: '/leave/team',
    title: 'Team Leave',
    roles: ['admin', 'manager'],
    feature: 'leave',
    summary: 'Approve or decline time-off for your team.',
    youAreHere: 'You are on Team Leave — decisions on other people’s time off.',
    steps: [
      'Open a pending request and approve or decline.',
      'Admins see workspace requests; managers see their team.',
      'Approved full-day leave can prevent clock-in on those dates.',
    ],
    suggestedQuestions: [
      'How do I approve a leave request?',
      'What happens after I approve?',
    ],
    body:
      'Team Leave for admin/manager. Approve or decline. Also available in the Approvals inbox. Employees never see this page.',
  },
  {
    id: 'approvals',
    path: '/approvals',
    title: 'Approvals',
    roles: ['admin', 'manager'],
    feature: 'approvals',
    summary: 'One inbox for leave and clock-note reviews.',
    youAreHere: 'You are on Approvals — items waiting on you, not your own leave form.',
    steps: [
      'Work through pending leave requests and time-clock notes.',
      'Approve or decline with a comment if needed.',
      'Items disappear from the inbox once decided.',
    ],
    suggestedQuestions: [
      'What shows up in Approvals?',
      'How is this different from Team Leave?',
    ],
    body:
      'Approvals inbox combines leave decisions and clock-note reviews for admin/manager. Same decisions as Team Leave / Team Time, collected in one list. Hidden from employees.',
  },

  // ── Content ───────────────────────────────────────────────────────────────
  {
    id: 'training',
    path: '/training',
    title: 'Training',
    feature: 'training',
    summary: 'Complete modules in order. Admins can also manage content and progress.',
    youAreHere: 'You are on Training — company learning modules, not the WSSO page tour.',
    steps: [
      'Open the next unpublished-for-you module in Learn and complete materials/quiz.',
      'Admins can switch to Manage to add modules and questions, and Progress to see completion.',
      'This is separate from the Help button, which explains WSSO screens.',
    ],
    suggestedQuestions: [
      'How do I complete a module?',
      'Who can add training content?',
    ],
    body:
      'Training modules with optional quiz and progress. Employees complete published modules in order. Only admins manage modules and see everyone’s progress. Not the in-app WSSO help tour.',
  },
  {
    id: 'documents',
    path: '/documents',
    title: 'Documents',
    feature: 'documents',
    summary: 'Shared files for the workspace.',
    youAreHere: 'You are on Documents — shared files, not My Work personal sheets.',
    steps: [
      'Browse or download files you are allowed to see.',
      'Admins (and permitted roles) upload or organize files.',
      'Use My Work for your private sheets; TACTICs for structured plans.',
    ],
    suggestedQuestions: [
      'How do I upload a file?',
      'Who can see these documents?',
    ],
    body:
      'Documents is the shared file library. Different from My Work (personal) and TACTIC documents (structured plans). Follow on-screen upload if you have permission.',
  },
  {
    id: 'sticky-notes',
    path: '/sticky-notes',
    title: 'Sticky Notes',
    summary: 'Personal notes that can also sit on other pages as stickies.',
    youAreHere: 'You are on the Sticky Notes board — your notes, not team announcements.',
    steps: [
      'Create a note and pick a color.',
      'On other pages, use the sticky button (bottom-right) to place a note on that screen.',
      'Notes are yours; they are not announcements to the company.',
    ],
    suggestedQuestions: [
      'How do I add a sticky on another page?',
      'Can other people see my notes?',
    ],
    body:
      'Sticky notes are personal reminders. The board lists them; other routes can show floating stickies. Not visible as company announcements. Announcements is a different page.',
  },
  {
    id: 'announcements',
    path: '/announcements',
    title: 'Announcements',
    feature: 'announcements',
    summary: 'Company posts from admins/managers. Everyone can read.',
    youAreHere: 'You are on Announcements — company news, not your private stickies.',
    steps: [
      'Read posts in the feed.',
      'Admins and managers can compose a new announcement.',
      'Employees read only; they should not expect a compose button.',
    ],
    suggestedQuestions: [
      'Who can post an announcement?',
      'Where else do announcements appear?',
    ],
    body:
      'Announcements are workspace posts. Admins/managers compose. Employees read (including dashboard cards). Not sticky notes and not email.',
  },
  {
    id: 'compliance',
    path: '/compliance',
    title: 'Licenses',
    roles: ['admin', 'manager'],
    feature: 'compliance',
    summary: 'Track licenses, certificates, and expiry dates.',
    youAreHere: 'You are on Licenses — compliance dates for the team, hidden from employees.',
    steps: [
      'Add a license or certificate with type, holder, and expiry.',
      'Watch items nearing expiry (also surfaced on the admin dashboard when enabled).',
      'Types come from workspace catalogs.',
    ],
    suggestedQuestions: [
      'How do I add a license?',
      'How do I see what is expiring soon?',
    ],
    body:
      'Compliance/licenses for admin and manager. Track certs, insurance, contracts and expiry. Employees do not get this page. Catalog types are configured in Workspace.',
  },
  {
    id: 'reports',
    path: '/reports',
    title: 'Reports',
    roles: ['admin', 'manager'],
    summary: 'Time, work orders, and project progress reports.',
    youAreHere: 'You are on Reports — analytics for managers and admins, not the employee timesheet.',
    steps: [
      'Pick a report (daily/weekly time, work orders, project progress).',
      'Set dates and filters, then review or export if available.',
      'Managers see team-scoped data; admins see the workspace.',
    ],
    suggestedQuestions: [
      'Which report shows hours by person?',
      'Can employees open Reports?',
    ],
    body:
      'Reports: time, work orders, project progress. Admin/manager only. Employees use My Time for their own hours. Do not tell employees how to run payroll exports.',
  },
  {
    id: 'activity-log',
    path: '/activity-log',
    title: 'Activity Log',
    summary: 'A feed of what changed — scoped to what you are allowed to see.',
    youAreHere: 'You are on Activity Log — history of actions in your access scope.',
    steps: [
      'Scroll or filter the feed for recent changes (work orders, assignments, and similar events).',
      'You will not see actions outside your role’s access.',
    ],
    suggestedQuestions: [
      'What events show up here?',
      'Can I see another person’s private activity?',
    ],
    body:
      'Activity Log lists recent workspace events the current user is allowed to view. It is not a way for employees to inspect admin settings or other people’s private HR data.',
  },

  // ── Account ───────────────────────────────────────────────────────────────
  {
    id: 'connect-ai',
    path: '/connect-ai',
    title: 'Connect AI',
    feature: 'connectAi',
    summary: 'Link an external AI tool to your WSSO account via MCP. This is not the Help chat.',
    youAreHere: 'You are on Connect AI — tokens for external agents (Cursor, Claude). The Help button is a separate in-app guide.',
    steps: [
      'Copy the server URL, token, and Workforce/Custom MCP fields if you use an external agent.',
      'The token follows your WSSO permissions (you will not get admin data as an employee).',
      'Rotate the token if it leaks. This is not the in-app Help chat.',
    ],
    suggestedQuestions: [
      'Is Connect AI the same as Help chat?',
      'What can an AI agent see with my token?',
    ],
    body:
      'Connect AI issues an MCP token so external tools can call WSSO as the signed-in user. Employee tokens stay employee-scoped. The floating Help chat only answers product questions from help articles and does not use this token.',
  },
  {
    id: 'notifications',
    path: '/notifications',
    title: 'Notifications',
    summary: 'In-app alerts (assignments, approvals, announcements).',
    youAreHere: 'You are on Notifications — your alert list.',
    steps: [
      'Open an item to go to the related page.',
      'Unread count also appears on the sidebar and the bell in the top bar.',
    ],
    suggestedQuestions: [
      'Why did I get a notification?',
      'How do I mark things read?',
    ],
    body:
      'Notifications are per-user alerts for work assigned, leave decisions, announcements, and similar. They are not SMS. The bell in the top bar opens a live dropdown.',
  },
  {
    id: 'billing',
    path: '/settings/billing',
    title: 'Subscription',
    roles: ['admin'],
    summary: 'Plan, trial, and Stripe checkout for this workspace.',
    youAreHere: 'You are on Subscription — admin billing. Employees never see this page.',
    steps: [
      'Review current plan, trial, or past-due status.',
      'Start checkout to subscribe or change plan.',
      'If the workspace is locked, paying here restores access for everyone.',
    ],
    suggestedQuestions: [
      'How do I subscribe?',
      'What happens if payment fails?',
    ],
    body:
      'Admin Subscription page (Stripe). Trial, plans, checkout, past due. When payment is required the workspace locks for other users until an admin pays. Employees and managers cannot open this page — tell them to contact the workspace admin.',
  },
  {
    id: 'workspace',
    path: '/settings',
    title: 'Workspace settings',
    roles: ['admin'],
    summary: 'Feature flags, time rules, catalogs, custom fields, hierarchy.',
    youAreHere: 'You are in Workspace settings — admin-only configuration for the whole company.',
    steps: [
      'Features: turn CRM, time, leave, Kanban, training, and other modules on or off.',
      'Time: overtime, required clock notes, work-week start, target hours.',
      'Catalogs: leave types, skills, license types, win/lost reasons.',
      'Custom fields and org hierarchy as needed.',
    ],
    suggestedQuestions: [
      'How do I hide CRM from the sidebar?',
      'How do I require a clock-out note?',
      'Where do I add leave types?',
    ],
    body:
      'Workspace settings are admin-only: feature flags (crm, time, leave, kanban, connectAi, myWork, documents, announcements, jobCosting, whoIsWorking, approvals, customFields, checklists, compliance, followUps, recurringJobs), time rules, work-order defaults, CRM follow-up rules, leave type required, catalogs, custom fields, hierarchy. Employees must never receive these instructions.',
  },
]
