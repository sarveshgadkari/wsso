import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerEmployeeTools } from './tools/employees'
import { registerTacticTools } from './tools/tactics'
import { registerTimeTools } from './tools/time'
import { registerProjectTools } from './tools/projects'
import { registerOrgTools } from './tools/org'
import { registerLeaveTools } from './tools/leave'
import { registerLeadTools } from './tools/leads'
import { registerDocumentTools } from './tools/documents'
import { registerTrainingTools } from './tools/training'
import { registerReportTools } from './tools/reports'
import { registerNotificationTools } from './tools/notifications'
import { registerResources } from './resources'
import { registerPrompts } from './prompts'

export function registerMcpServer(server: McpServer) {
  registerEmployeeTools(server)
  registerOrgTools(server)
  registerTacticTools(server)
  registerTimeTools(server)
  registerProjectTools(server)
  registerLeaveTools(server)
  registerLeadTools(server)
  registerDocumentTools(server)
  registerTrainingTools(server)
  registerReportTools(server)
  registerNotificationTools(server)
  registerResources(server)
  registerPrompts(server)
}
