-- Long-lived MCP connection tokens (for Workforce 2.0 / Custom MCP).
-- Opaque token is shown on Connect AI; only hash + encrypted blob stored.

CREATE TABLE IF NOT EXISTS public.mcp_connection_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash      text NOT NULL UNIQUE,
  token_encrypted text NOT NULL,
  token_prefix    text NOT NULL,
  label           text NOT NULL DEFAULT 'Workforce 2.0',
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  last_used_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_tokens_user_active
  ON public.mcp_connection_tokens(user_id)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE public.mcp_connection_tokens IS
  'Long-lived MCP API tokens for AI clients (e.g. Workforce Custom MCP).';

ALTER TABLE public.mcp_connection_tokens ENABLE ROW LEVEL SECURITY;

-- Users can see metadata for their own tokens (not decrypt — app uses service role for that)
DROP POLICY IF EXISTS "mcp_tokens_select_own" ON public.mcp_connection_tokens;
CREATE POLICY "mcp_tokens_select_own" ON public.mcp_connection_tokens
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Inserts/updates/deletes go through server (service role) from Connect AI API
