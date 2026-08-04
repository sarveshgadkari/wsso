# WSSO

Workforce management platform (Next.js + Supabase).

## MCP (AI agent access)

WSSO includes an employee-scoped MCP server so AI tools (Cursor, Claude, custom agents) can use WSSO data with the same permissions as the signed-in user.

| | |
|---|---|
| App | [https://wsso.vercel.app](https://wsso.vercel.app/) |
| MCP endpoint | `https://wsso.vercel.app/api/mcp/mcp` |
| Auth | `Authorization: Bearer <supabase_access_token>` |
| Deploy & share guide | [docs/MCP.md](docs/MCP.md) |
| Cursor example config | [.cursor/mcp.json.example](.cursor/mcp.json.example) |

### Quick verify

```bash
npm run dev
npm run test:mcp
npm run test:mcp:manager
```

## Scripts

```bash
npm run dev
npm run build
npm run typecheck
npm run test:mcp
npm run test:mcp:manager
```
