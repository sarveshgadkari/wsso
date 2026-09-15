export type HelpFaq = {
  articleId: string
  questions: string[]
  answer: string
}

export function questionsForArticle(article: { id: string; suggestedQuestions: string[] }, limit = 8): string[] {
  const fromFaq = HELP_FAQS.filter((f) => f.articleId === article.id).flatMap((f) => f.questions)
  const all = [...article.suggestedQuestions, ...fromFaq]
  const seen = new Set<string>()
  const out: string[] = []
  for (const q of all) {
    const k = q.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(q)
    if (out.length >= limit) break
  }
  return out
}

/** Fixed Q&A the voice/text agent can match. Role/feature come from the parent article. */
export const HELP_FAQS: HelpFaq[] = [
  // ── General / overview ────────────────────────────────────────────────────
  {
    articleId: 'overview-employee',
    questions: [
      'What is WSSO?',
      'What can I do in WSSO?',
      'Why can I not see admin pages?',
      'Why is a menu item missing?',
      'Who should I ask if I need more access?',
      'Can I see other people hours?',
      'Can I approve leave?',
      'How do I sign out?',
      'How do I get help?',
      'What is this help bot?',
    ],
    answer:
      'WSSO is your workforce app for your own work, time, leave, and training. You only see pages in your sidebar. You cannot open billing, companies, team time, approvals, or reports. Sign out from the top-right. This help bot only answers WSSO questions for your role. If a menu item is missing, the admin may have turned that feature off, or it is not for employees.',
  },
  {
    articleId: 'overview-manager',
    questions: [
      'What can a manager do in WSSO?',
      'What can I not change as a manager?',
      'How do I run my team in WSSO?',
    ],
    answer:
      'As a manager you can assign work, review Team Time, approve leave, and use Reports for your team. You cannot change Subscription, Workspace features, Companies, or the full CRM. Ask the workspace admin for those.',
  },
  {
    articleId: 'overview-admin',
    questions: [
      'What can an admin do?',
      'How do I set up the workspace?',
      'Where do I start as admin?',
    ],
    answer:
      'Admins run the whole workspace. Add people under Employees, turn modules on in Workspace, subscribe under Subscription, then create companies, projects, and work orders. You can also ask how employees use My Time or Leave so you can train them.',
  },
  {
    articleId: 'overview-director',
    questions: [
      'What can a director do?',
      'Can I change billing as director?',
    ],
    answer:
      'Directors get a leadership dashboard plus personal work pages. Billing, companies, CRM, and team approvals stay with the admin or managers. Ask them if you need those changes.',
  },
  {
    articleId: 'overview-employee',
    questions: ['How do I reset my password?', 'I forgot my password', 'How do I change my password?', 'How do I log in?'],
    answer:
      'Use Forgot password on the login screen. If you were invited, open the set-password email from your admin. This help bot cannot reset passwords or sign you in.',
  },
  {
    articleId: 'overview-manager',
    questions: ['How do I reset my password?', 'I forgot my password', 'How do I change my password?', 'How do I log in?'],
    answer:
      'Use Forgot password on the login screen. This help bot cannot reset passwords.',
  },
  {
    articleId: 'overview-admin',
    questions: ['How do I reset my password?', 'I forgot my password', 'How do I change my password?', 'How do I log in?'],
    answer:
      'Use Forgot password on the login screen. To reset someone else password, open Employees and send them a set-password email.',
  },
  {
    articleId: 'overview-director',
    questions: ['How do I reset my password?', 'I forgot my password', 'How do I change my password?', 'How do I log in?'],
    answer:
      'Use Forgot password on the login screen. This help bot cannot reset passwords.',
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  {
    articleId: 'dashboard-employee',
    questions: [
      'What is the dashboard?',
      'What should I do first today?',
      'Where is the clock on the dashboard?',
      'Why is my dashboard empty?',
      'Can I see company stats on the dashboard?',
    ],
    answer:
      'Your dashboard is the home screen for your day. Clock in from the time widget, then check work orders assigned to you. You will not see company-wide stats or other people timesheets. If a card is missing, that feature may be off in Workspace.',
  },
  {
    articleId: 'dashboard-admin',
    questions: [
      'What do the dashboard cards mean?',
      'How do I see who is working?',
      'Where is overdue work on the dashboard?',
      'What should I check first as admin?',
    ],
    answer:
      'Admin dashboard cards jump into employees, companies, projects, and open work orders. Who is working shows people currently clocked in if that feature is on. Overdue jobs and pending leave also appear in the ops strip. Check billing if a subscription card is shown.',
  },
  {
    articleId: 'dashboard-manager',
    questions: [
      'What is on the manager dashboard?',
      'How do I see my team from the dashboard?',
    ],
    answer:
      'The manager dashboard shows your clock plus team work: open jobs, overdue items, and shortcuts to Team Time, Team Leave, and Approvals.',
  },

  // ── Time ──────────────────────────────────────────────────────────────────
  {
    articleId: 'my-time',
    questions: [
      'How do I clock in?',
      'How do I clock out?',
      'Where is the time clock?',
      'How do I start my shift?',
      'How do I punch in?',
      'How do I punch out?',
      'I forgot to clock out',
      'I forgot to clock in',
      'Why can I not clock in?',
      'Why is clock in disabled?',
      'Can I clock in twice today?',
      'Do I need a note to clock in?',
      'Do I need a note to clock out?',
      'What timezone is my time in?',
      'How do I see my hours?',
      'Where is my timesheet?',
      'How many hours did I work this week?',
      'What happens at midnight?',
      'Does leave block clock in?',
      'Can I edit my time log?',
      'Who can see my hours?',
      'Is overtime tracked?',
      'How do I add a clock note?',
    ],
    answer:
      'Clock in from the dashboard time widget, or use My Time. One session per day. If the workspace requires notes, type a clock-in or clock-out note when asked. You cannot clock in again after you complete the day. Approved full-day leave can block clock-in. Time follows your profile timezone and may auto-close at midnight. Open My Time for your chart and log. You cannot edit other people hours. If you forgot to clock out, ask a manager or admin to force clock-out on Team Time. Managers see your hours on Team Time, not on your My Time page.',
  },
  {
    articleId: 'team-time',
    questions: [
      'How do I see team hours?',
      'Who is still clocked in?',
      'How do I open someone timesheet?',
      'How do I force clock out?',
      'When do I force clock-out?',
      'How do I review clock notes?',
      'Can I change an employee time?',
      'Where is payroll time?',
    ],
    answer:
      'Team Time lists your team or the whole workspace, depending on your role. Open a person for their log. Use force clock-out only if someone left a session open. Review pending clock notes here or in Approvals. Payroll-style reports are under Reports, not on the employee My Time page.',
  },

  // ── Leave ─────────────────────────────────────────────────────────────────
  {
    articleId: 'my-leave',
    questions: [
      'How do I request leave?',
      'How do I apply for time off?',
      'How do I take vacation?',
      'How do I request a half day?',
      'What leave types are there?',
      'Who approves my leave?',
      'Why is my leave pending?',
      'Can I cancel leave?',
      'My leave was declined',
      'Can I approve my own leave?',
      'How long until leave is approved?',
      'What is half day period?',
    ],
    answer:
      'Open My Leave and create a request with start date, end date, optional half-day morning or afternoon, and a leave type if your workspace requires one. A manager or admin approves or declines it. You cannot approve your own leave. Status stays on this list: pending, approved, or declined. Ask your manager if it stays pending. Approved full-day leave can block clock-in on those dates.',
  },
  {
    articleId: 'team-leave',
    questions: [
      'How do I approve leave?',
      'How do I decline leave?',
      'Where are pending leave requests?',
      'What happens after I approve leave?',
    ],
    answer:
      'Open Team Leave or Approvals. Open a pending request and approve or decline. Approved full-day leave can stop that person clocking in on those dates. Managers see their team. Admins see the workspace.',
  },
  {
    articleId: 'approvals',
    questions: [
      'What is the approvals inbox?',
      'What shows in approvals?',
      'How is approvals different from team leave?',
      'How do I clear the approvals badge?',
    ],
    answer:
      'Approvals is one inbox for leave requests and clock-note reviews. It is the same decisions as Team Leave and Team Time, collected together. Items leave the inbox when you decide. Employees do not see this page.',
  },

  // ── Work orders ───────────────────────────────────────────────────────────
  {
    articleId: 'work-orders-employee',
    questions: [
      'Where are my work orders?',
      'Where are my tasks?',
      'How do I update a work order?',
      'How do I change status?',
      'What does overdue mean?',
      'What is TAC001?',
      'Can I assign a job to someone else?',
      'Can I create a work order?',
      'How do I open a job?',
      'What is a checklist on a work order?',
      'How do I log time on a job?',
    ],
    answer:
      'Work Orders shows jobs assigned to you. Codes like TAC001 are auto-generated. Open a row for details, checklist, and updates. Change status as you work if you are allowed. Overdue means the due date passed. You generally cannot reassign company-wide or create jobs for other people — ask your manager. Log time with the clock; some workspaces also show hours on the job.',
  },
  {
    articleId: 'work-orders-staff',
    questions: [
      'How do I create a work order?',
      'How do I assign a work order?',
      'How do I assign a job to my team?',
      'What do TAC codes mean?',
      'How do I set a due date?',
      'How do I add a checklist?',
      'What is job costing?',
      'Can I make a recurring job?',
      'How do I filter work orders?',
      'What is the difference between admin and manager work orders?',
    ],
    answer:
      'Create a work order from the Work Orders page: title, assignee, project, due date, priority, and checklist if required. Codes like TAC001 are automatic. Admins see all jobs. Managers see jobs they created or assigned to their team. Job costing is hours times rate when that feature is on. Recurring jobs and custom fields appear only if enabled in Workspace.',
  },
  {
    articleId: 'kanban',
    questions: [
      'What is kanban?',
      'How do I move a card?',
      'Is kanban different from work orders?',
      'Why can I not see every card?',
      'How do I change status on the board?',
    ],
    answer:
      'Kanban is the same work orders shown as columns by status. Drag a card to change status if you can update that job. Click a card for the full record. Employees usually only see their assignments.',
  },
  {
    articleId: 'tactic-documents',
    questions: [
      'What is a TACTIC document?',
      'How do I create a TACTIC?',
      'Who approves a TACTIC?',
      'What is the difference between TACTICs and work orders?',
      'How do I share a TACTIC?',
    ],
    answer:
      'TACTICs are written plans with tasks and next steps. Work Orders are day-to-day jobs on /tactics. Employees submit TACTIC documents; managers or admins approve or send back. Use share if someone else must view or edit.',
  },
  {
    articleId: 'my-work',
    questions: [
      'What is My Work?',
      'How do I upload Excel?',
      'How do I create a page?',
      'How do I link a sheet to a work order?',
      'What is the difference between a table and a page?',
      'Can I share my work folder?',
      'Is My Work the same as Documents?',
    ],
    answer:
      'My Work is your personal notebooks. Upload Excel for a table, or create a page for notes and tasks. Link rows to a work order when the work belongs to a job. Folders can be shared if your workspace allows it. Documents is the company file library, not your private sheets.',
  },

  // ── Org ───────────────────────────────────────────────────────────────────
  {
    articleId: 'employees',
    questions: [
      'How do I add an employee?',
      'How do I invite a user?',
      'How do I send a password email?',
      'What roles can I assign?',
      'How do I deactivate someone?',
      'How do I delete a profile?',
      'How do I change someone role?',
      'How do I assign a manager?',
      'How do I set timezone for an employee?',
      'Why can I not delete a manager?',
    ],
    answer:
      'Admins create people on Employees, pick director, manager, or employee, assign companies, and send the set-password email. Open a person to edit their profile. Delete profile removes the account permanently; deactivate if you only want to block sign-in. Managers see their team, not the whole company. You cannot promote someone to workspace admin from the create form. If a manager still owns a team, reassign the team before changing their role or deleting them.',
  },
  {
    articleId: 'companies',
    questions: [
      'How do I add a company?',
      'What is a company in WSSO?',
      'How do I link an employee to a company?',
    ],
    answer:
      'Companies are entities or brands in the workspace. Only admins add them. Link people from the employee profile. This is not Clients (customers) and not CRM leads.',
  },
  {
    articleId: 'projects',
    questions: [
      'How do I create a project?',
      'How do work orders attach to a project?',
      'What project statuses exist?',
    ],
    answer:
      'Admins and managers create projects with a name, code, optional manager, and status: active, on hold, or completed. Attach a work order to a project when you create or edit the job. Open a project to see related work.',
  },
  {
    articleId: 'clients',
    questions: [
      'How do I add a client?',
      'How is a client different from a lead?',
      'How do I convert a lead to a client?',
    ],
    answer:
      'Clients are customers. Leads are prospects in CRM. Admins convert a won lead into a client. Employees use My Leads, not this full client list.',
  },

  // ── CRM ───────────────────────────────────────────────────────────────────
  {
    articleId: 'crm',
    questions: [
      'How do I add a lead?',
      'How do I import leads from CSV?',
      'How do I assign a lead?',
      'How do I convert a lead to a client?',
      'What are win and lost reasons?',
      'How do follow-ups work?',
      'Where do website enquiries go?',
    ],
    answer:
      'Admin CRM holds every lead. Add one, or import CSV. Assign people so the lead appears on My Leads. Set follow-up dates if that feature is on. Win and lost reasons come from Workspace catalogs. Website enquiry forms also land here. Convert a won lead to a client when the deal closes.',
  },
  {
    articleId: 'my-leads',
    questions: [
      'Where are my leads?',
      'How do I update a lead status?',
      'Why is a lead missing?',
      'Can I import CSV as an employee?',
      'Can I add a company-wide lead?',
    ],
    answer:
      'My Leads shows only prospects assigned to you. Update status and follow-ups there. You cannot import all company leads or run the admin CRM. If a lead is missing, ask an admin to assign it.',
  },

  // ── Content ───────────────────────────────────────────────────────────────
  {
    articleId: 'training',
    questions: [
      'How do I complete training?',
      'How do I pass a quiz?',
      'Who can add training modules?',
      'Where is my training progress?',
      'Is training the same as this help tour?',
    ],
    answer:
      'Open Training and complete published modules in order, including any quiz. Admins add modules and see everyone progress. This Help button explains WSSO screens. Training is company learning content, not the product tour.',
  },
  {
    articleId: 'documents',
    questions: [
      'How do I upload a file?',
      'Who can see documents?',
      'Is this My Work?',
    ],
    answer:
      'Documents is the shared file library. Upload if you have permission. My Work is personal sheets. TACTICs are structured plans.',
  },
  {
    articleId: 'sticky-notes',
    questions: [
      'How do I add a sticky note?',
      'Can other people see my sticky notes?',
      'How do I put a note on another page?',
      'Are sticky notes announcements?',
    ],
    answer:
      'Sticky notes are your private reminders. Create them on the Sticky Notes board, or use the sticky button on other pages. They are not company announcements.',
  },
  {
    articleId: 'announcements',
    questions: [
      'Who can post an announcement?',
      'Where do I read announcements?',
      'Can employees post announcements?',
    ],
    answer:
      'Admins and managers compose announcements. Everyone can read them here and on dashboard cards. Employees do not get a compose button.',
  },
  {
    articleId: 'compliance',
    questions: [
      'How do I add a license?',
      'How do I see expiring certificates?',
      'What is compliance in WSSO?',
    ],
    answer:
      'Licenses tracks certificates, insurance, and expiry for the team. Add a type, holder, and expiry date. Types come from Workspace catalogs. Expiring items also show on the admin dashboard. Employees do not see this page.',
  },
  {
    articleId: 'reports',
    questions: [
      'Which report shows hours?',
      'How do I export a report?',
      'Can employees open reports?',
      'Where is the work orders report?',
      'Where is project progress?',
    ],
    answer:
      'Reports has daily and weekly time, work orders, and project progress. Managers see team scope. Admins see the workspace. Employees use My Time for their own hours and cannot open Reports.',
  },
  {
    articleId: 'activity-log',
    questions: [
      'What is the activity log?',
      'Can I see another person private activity?',
    ],
    answer:
      'Activity Log is a feed of changes you are allowed to see, such as work order updates. It is not a way to inspect other people private HR data or admin settings you cannot open.',
  },
  {
    articleId: 'notifications',
    questions: [
      'Why did I get a notification?',
      'How do I mark notifications read?',
      'Where is the bell?',
    ],
    answer:
      'Notifications alert you about assignments, leave decisions, and announcements. Open the bell in the top bar or the Notifications page. Opening an item takes you to the related screen.',
  },
  {
    articleId: 'connect-ai',
    questions: [
      'What is Connect AI?',
      'Is Connect AI the same as this help chat?',
      'What can an AI agent see with my token?',
      'How do I rotate the MCP token?',
    ],
    answer:
      'Connect AI gives an external tool like Cursor a token to use WSSO as you. It is not this Help voice agent. The token follows your permissions, so an employee token cannot see admin data. Rotate the token if it leaks.',
  },

  // ── Admin settings ────────────────────────────────────────────────────────
  {
    articleId: 'billing',
    questions: [
      'How do I subscribe?',
      'How do I pay?',
      'What happens if payment fails?',
      'Why is the workspace locked?',
      'Where is the trial?',
      'How do I change plan?',
    ],
    answer:
      'Only the workspace admin opens Subscription. Review the plan, trial, or past-due status and start Stripe checkout. If payment fails the workspace locks for others until an admin pays. Employees must ask the admin, not this help chat, to change billing.',
  },
  {
    articleId: 'workspace',
    questions: [
      'How do I turn CRM off?',
      'How do I hide a sidebar item?',
      'How do I require a clock note?',
      'Where do I add leave types?',
      'How do I set overtime?',
      'What are custom fields?',
      'How do I change the work week start?',
    ],
    answer:
      'Workspace settings are admin-only. Features turns modules like CRM, time, leave, and Kanban on or off, which hides them from the sidebar. Time rules cover overtime, required clock notes, work-week start, and target hours. Catalogs hold leave types, skills, and license types. Custom fields add extra data on people, clients, jobs, and projects.',
  },
]
