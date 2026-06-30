-- =============================================================================
-- Add auto_closed flag to time_logs.
-- Make activity_logs.tactic_id nullable so non-tactic events (e.g. force
-- clock-out) can be audited there without requiring a fake tactic.
-- Add a meta JSONB column to activity_logs for structured audit context.
-- =============================================================================

ALTER TABLE public.time_logs
  ADD COLUMN IF NOT EXISTS auto_closed boolean NOT NULL DEFAULT false;

ALTER TABLE public.activity_logs
  ALTER COLUMN tactic_id DROP NOT NULL;

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS meta jsonb;
