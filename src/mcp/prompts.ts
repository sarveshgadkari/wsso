import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    'weekly_review',
    {
      title: 'Weekly Review',
      description:
        'Generate a weekly review for the connected employee covering work orders, time, and leave.',
      argsSchema: {
        start_date: z.string().describe('Week start YYYY-MM-DD'),
        end_date: z.string().describe('Week end YYYY-MM-DD'),
      },
    },
    ({ start_date, end_date }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text:
              `Prepare a weekly review for ${start_date} to ${end_date}. ` +
              `Use employees_me, tactics_list, time_my_logs, leave_list, and reports_timesheet. ` +
              `Summarize completed work, open work orders, hours logged, and leave. ` +
              `Flag blockers and suggest next actions.`,
          },
        },
      ],
    }),
  )

  server.registerPrompt(
    'project_status',
    {
      title: 'Project Status',
      description: 'Summarize health and progress for a project.',
      argsSchema: {
        project_id: z.string().uuid().describe('Project UUID'),
      },
    },
    ({ project_id }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text:
              `Summarize project ${project_id}. Use projects_get, tactics_list with that project_id, ` +
              `and reports_project_progress. Include status breakdown, overdue items, and risks.`,
          },
        },
      ],
    }),
  )

  server.registerPrompt(
    'onboard_employee_checklist',
    {
      title: 'Onboard Employee Checklist',
      description: 'Checklist for onboarding a new employee in WSSO.',
      argsSchema: {
        employee_name: z.string().describe('New employee full name'),
      },
    },
    ({ employee_name }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text:
              `Create an onboarding checklist for ${employee_name} in WSSO. ` +
              `Cover account setup, company/team assignment, first work order, time clock guidance, ` +
              `leave policy awareness, and training modules. Use org_hierarchy and training_list_modules for context.`,
          },
        },
      ],
    }),
  )
}
