import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { verifyMcpToken } from '@/mcp/auth'
import { registerMcpServer } from '@/mcp/register'

export const runtime = 'nodejs'
export const maxDuration = 60

const handler = createMcpHandler(
  (server) => {
    registerMcpServer(server)
  },
  {
    serverInfo: {
      name: 'wsso-mcp',
      version: '0.1.0',
    },
  },
  {
    basePath: '/api/mcp',
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === 'development',
  },
)

const authHandler = withMcpAuth(handler, verifyMcpToken, {
  required: true,
})

export { authHandler as GET, authHandler as POST, authHandler as DELETE }
