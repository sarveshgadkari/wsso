-- =============================================================================
-- WSSO ⇄ Omni Force Vector integration
-- Run in the WSSO Supabase project (SQL Editor), after the SaaS scripts.
-- Also copied to saas/14_omniforce_integration.sql. Safe to re-run.
--
-- People whose WSSO access comes from Omni Force Vector:
--   * sign in through Omni Force Vector (no WSSO password, no WSSO signup)
--   * get their workspace created on first sign-in (just-in-time)
--   * never pay inside WSSO: the workspace is billed by Omni Force Vector
-- Existing WSSO customers and logins are untouched (billing_source = 'wsso').
-- =============================================================================

-- 1. Identity mapping: one WSSO profile ⇄ one Omni Force Vector user (sub).
--    Never matched by email.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS omniforce_user_id   text,
  ADD COLUMN IF NOT EXISTS omniforce_linked_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_omniforce_user_uidx
  ON public.profiles (omniforce_user_id)
  WHERE omniforce_user_id IS NOT NULL;

-- 2. Workspaces billed and governed by Omni Force Vector.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_source text NOT NULL DEFAULT 'wsso',
  -- personal workspace: the Omni Force Vector user who owns it
  ADD COLUMN IF NOT EXISTS omniforce_owner_user_id   text,
  -- organization workspace: the Omni Force Vector organization it belongs to
  ADD COLUMN IF NOT EXISTS omniforce_organization_id uuid;

DO $$ BEGIN
  ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_billing_source_chk CHECK (billing_source IN ('wsso', 'omniforce'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- one personal workspace per Omni Force Vector user, one workspace per Omni Force Vector organization
CREATE UNIQUE INDEX IF NOT EXISTS organizations_omniforce_owner_uidx
  ON public.organizations (omniforce_owner_user_id)
  WHERE omniforce_owner_user_id IS NOT NULL AND omniforce_organization_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_omniforce_org_uidx
  ON public.organizations (omniforce_organization_id)
  WHERE omniforce_organization_id IS NOT NULL;

-- 3. Signed-in users can never change these columns (only the service role can).
--    Otherwise a user could point their profile at someone else's Omni Force Vector identity.
CREATE OR REPLACE FUNCTION public._trg_protect_omniforce_columns()
  RETURNS trigger LANGUAGE plpgsql
  SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') IN ('authenticated', 'anon') THEN
    IF TG_TABLE_NAME = 'profiles' THEN
      IF NEW.omniforce_user_id IS DISTINCT FROM OLD.omniforce_user_id
         OR NEW.omniforce_linked_at IS DISTINCT FROM OLD.omniforce_linked_at THEN
        RAISE EXCEPTION 'Omni Force Vector identity fields are managed by Omni Force Vector';
      END IF;
    ELSIF TG_TABLE_NAME = 'organizations' THEN
      IF NEW.billing_source IS DISTINCT FROM OLD.billing_source
         OR NEW.omniforce_owner_user_id IS DISTINCT FROM OLD.omniforce_owner_user_id
         OR NEW.omniforce_organization_id IS DISTINCT FROM OLD.omniforce_organization_id THEN
        RAISE EXCEPTION 'Omni Force Vector billing fields are managed by Omni Force Vector';
      END IF;
      IF OLD.billing_source = 'omniforce'
         AND (NEW.status, NEW.seat_limit, NEW.plan, NEW.plan_id) IS DISTINCT FROM (OLD.status, OLD.seat_limit, OLD.plan, OLD.plan_id) THEN
        RAISE EXCEPTION 'This workspace''s plan is managed in Omni Force Vector';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_omniforce_columns ON public.profiles;
CREATE TRIGGER trg_protect_omniforce_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public._trg_protect_omniforce_columns();

DROP TRIGGER IF EXISTS trg_protect_omniforce_columns ON public.organizations;
CREATE TRIGGER trg_protect_omniforce_columns
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public._trg_protect_omniforce_columns();

-- 4. Replay protection for signed events from Omni Force Vector.
CREATE TABLE IF NOT EXISTS public.omniforce_events (
  event_id    text PRIMARY KEY,
  event       text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}',
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.omniforce_events ENABLE ROW LEVEL SECURITY;  -- no policies: service role only
REVOKE ALL ON public.omniforce_events FROM anon, authenticated;

COMMENT ON COLUMN public.organizations.billing_source IS
  'wsso = billed by WSSO Stripe; omniforce = access and seats granted by Omni Force Vector (no WSSO payment).';
