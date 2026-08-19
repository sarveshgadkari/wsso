import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { SignJWT } from 'jose'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const MCP_TOKEN_PREFIX = 'wsso_mcp_'
export const MCP_TOKEN_TTL_DAYS = 30

function encryptionKey(): Buffer {
  const material =
    process.env.MCP_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  if (!material) {
    throw new Error('MCP_TOKEN_SECRET or SUPABASE_SERVICE_ROLE_KEY is required')
  }
  return createHash('sha256').update(material).digest()
}

export function hashMcpToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

export function encryptMcpToken(rawToken: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const enc = Buffer.concat([cipher.update(rawToken, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`
}

export function decryptMcpToken(blob: string): string {
  const [ivB64, tagB64, dataB64] = blob.split('.')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Invalid encrypted token')
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivB64, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function generateRawMcpToken(): string {
  return `${MCP_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`
}

export function isMcpLongLivedToken(token: string): boolean {
  return token.startsWith(MCP_TOKEN_PREFIX)
}

/** Mint a short-lived Supabase-compatible JWT so RLS still applies. */
export async function mintSupabaseUserJwt(userId: string, email?: string | null) {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    throw new Error(
      'SUPABASE_JWT_SECRET is not set. Add it from Supabase → Project Settings → API → JWT Secret.',
    )
  }

  const key = new TextEncoder().encode(secret)
  const jwt = await new SignJWT({
    role: 'authenticated',
    aud: 'authenticated',
    ...(email ? { email } : {}),
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(key)

  return jwt
}

export type McpTokenRecord = {
  id: string
  user_id: string
  token_hash: string
  token_encrypted: string
  token_prefix: string
  label: string
  expires_at: string
  revoked_at: string | null
  last_used_at: string | null
  created_at: string
}

export async function getActiveMcpToken(userId: string): Promise<McpTokenRecord | null> {
  const { data, error } = await supabaseAdmin
    .from('mcp_connection_tokens')
    .select('*')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as McpTokenRecord | null) ?? null
}

export async function revokeUserMcpTokens(userId: string) {
  await supabaseAdmin
    .from('mcp_connection_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null)
}

export async function createMcpToken(userId: string, label = 'Workforce 2.0') {
  await revokeUserMcpTokens(userId)

  const raw = generateRawMcpToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + MCP_TOKEN_TTL_DAYS)

  const row = {
    user_id: userId,
    token_hash: hashMcpToken(raw),
    token_encrypted: encryptMcpToken(raw),
    token_prefix: raw.slice(0, 16),
    label,
    expires_at: expiresAt.toISOString(),
  }

  const { data, error } = await supabaseAdmin
    .from('mcp_connection_tokens')
    .insert(row)
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  return {
    record: data as McpTokenRecord,
    rawToken: raw,
  }
}

export async function resolveMcpLongLivedToken(rawToken: string): Promise<{
  userId: string
  email: string | null
  supabaseJwt: string
} | null> {
  if (!isMcpLongLivedToken(rawToken)) return null

  const tokenHash = hashMcpToken(rawToken)
  const { data, error } = await supabaseAdmin
    .from('mcp_connection_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .maybeSingle()

  if (error || !data) return null

  const row = data as McpTokenRecord
  if (new Date(row.expires_at).getTime() <= Date.now()) return null

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(row.user_id)
  const email = authUser.user?.email ?? null

  const supabaseJwt = await mintSupabaseUserJwt(row.user_id, email)

  await supabaseAdmin
    .from('mcp_connection_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', row.id)

  return { userId: row.user_id, email, supabaseJwt }
}
