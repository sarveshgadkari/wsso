-- =============================================================================
-- WSSO SaaS 02 — Organizations, tenant columns, backfill, per-org codes
-- Run AFTER 01_add_super_admin_role.sql
-- Safe-ish to re-run: ADD COLUMN IF NOT EXISTS / CREATE IF NOT EXISTS
-- =============================================================================


-- ============================================================
-- A. Plan / status enums
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.org_plan AS ENUM (
    'trial', 'starter', 'growth', 'business', 'enterprise'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.org_status AS ENUM (
    'trial', 'active', 'past_due', 'suspended', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- B. organizations (one row = one paying customer / workspace)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text NOT NULL,
  plan            public.org_plan   NOT NULL DEFAULT 'trial',
  status          public.org_status NOT NULL DEFAULT 'trial',
  seat_limit      integer NOT NULL DEFAULT 10 CHECK (seat_limit > 0),
  trial_ends_at   timestamptz,
  billing_email   text,
  notes           text,
  mcp_enabled     boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_slug_format_chk
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_uidx
  ON public.organizations (slug);

CREATE INDEX IF NOT EXISTS idx_organizations_status
  ON public.organizations (status);

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public._trg_set_updated_at();

COMMENT ON TABLE public.organizations IS
  'SaaS tenants. Super Admin manages these; every business row points here.';


-- ============================================================
-- C. Helper functions (plpgsql — safe to create before the new columns)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
  RETURNS boolean
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT role = 'super_admin' FROM public.profiles WHERE id = auth.uid()),
    false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_org_id()
  RETURNS uuid
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT organization_id
    FROM   public.profiles
    WHERE  id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.same_org(p_org_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  RETURN public.is_super_admin()
      OR (p_org_id IS NOT NULL AND p_org_id = public.get_my_org_id());
END;
$$;

CREATE OR REPLACE FUNCTION public.org_active_seat_count(p_org_id uuid)
  RETURNS integer
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT count(*)::integer
    FROM   public.profiles
    WHERE  organization_id = p_org_id
      AND  status = 'active'
      AND  role <> 'super_admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.org_can_add_seat(p_org_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    public.org_active_seat_count(p_org_id) < (
      SELECT seat_limit FROM public.organizations WHERE id = p_org_id
    ),
    false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.org_is_access_allowed(p_org_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  rec public.organizations%ROWTYPE;
BEGIN
  IF p_org_id IS NULL THEN
    RETURN public.is_super_admin();
  END IF;

  SELECT * INTO rec FROM public.organizations WHERE id = p_org_id;
  IF rec.id IS NULL THEN
    RETURN false;
  END IF;

  IF rec.status IN ('suspended', 'cancelled') THEN
    RETURN false;
  END IF;

  IF rec.status = 'trial' AND rec.trial_ends_at IS NOT NULL AND rec.trial_ends_at < now() THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin()             TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_org_id()             TO authenticated;
GRANT EXECUTE ON FUNCTION public.same_org(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_active_seat_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_can_add_seat(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_is_access_allowed(uuid) TO authenticated;


-- ============================================================
-- D. Add organization_id to every business table
-- ============================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'profiles',
    'companies',
    'teams',
    'employee_companies',
    'clients',
    'projects',
    'tactics',
    'tactic_assignees',
    'activity_logs',
    'time_logs',
    'documents',
    'notifications',
    'announcements',
    'employee_work_sheets',
    'employee_work_sheet_folders',
    'employee_work_sheet_shares',
    'employee_work_sheet_folder_shares',
    'tactic_documents',
    'tactic_tasks',
    'tactic_next_steps',
    'tactic_document_shares',
    'leads',
    'lead_assignments',
    'leave_requests',
    'training_modules',
    'training_questions',
    'training_progress',
    'mcp_connection_tokens'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE',
        t
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%s_organization_id ON public.%I (organization_id)',
        t, t
      );
    END IF;
  END LOOP;
END $$;


-- ============================================================
-- E. Backfill: wrap all current data in one workspace
-- ============================================================

INSERT INTO public.organizations (name, slug, plan, status, seat_limit, trial_ends_at)
SELECT
  COALESCE(
    (SELECT name FROM public.companies ORDER BY created_at ASC NULLS LAST LIMIT 1),
    'Default Workspace'
  ),
  'default',
  'business',
  'active',
  150,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM public.organizations WHERE slug = 'default');

DO $$
DECLARE
  default_org uuid;
  t text;
  tables text[] := ARRAY[
    'profiles',
    'companies',
    'teams',
    'employee_companies',
    'clients',
    'projects',
    'tactics',
    'tactic_assignees',
    'activity_logs',
    'time_logs',
    'documents',
    'notifications',
    'announcements',
    'employee_work_sheets',
    'employee_work_sheet_folders',
    'employee_work_sheet_shares',
    'employee_work_sheet_folder_shares',
    'tactic_documents',
    'tactic_tasks',
    'tactic_next_steps',
    'tactic_document_shares',
    'leads',
    'lead_assignments',
    'leave_requests',
    'training_modules',
    'training_questions',
    'training_progress',
    'mcp_connection_tokens'
  ];
BEGIN
  SELECT id INTO default_org FROM public.organizations WHERE slug = 'default' LIMIT 1;

  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id'
    ) THEN
      EXECUTE format(
        'UPDATE public.%I SET organization_id = $1 WHERE organization_id IS NULL',
        t
      ) USING default_org;
    END IF;
  END LOOP;
END $$;


-- ============================================================
-- F. NOT NULL + profiles rule (super_admin has no tenant)
-- ============================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'companies',
    'teams',
    'employee_companies',
    'clients',
    'projects',
    'tactics',
    'tactic_assignees',
    'activity_logs',
    'time_logs',
    'documents',
    'notifications',
    'announcements',
    'employee_work_sheets',
    'employee_work_sheet_folders',
    'employee_work_sheet_shares',
    'employee_work_sheet_folder_shares',
    'tactic_documents',
    'tactic_tasks',
    'tactic_next_steps',
    'tactic_document_shares',
    'leads',
    'lead_assignments',
    'leave_requests',
    'training_modules',
    'training_questions',
    'training_progress',
    'mcp_connection_tokens'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND column_name = 'organization_id'
    ) THEN
      BEGIN
        EXECUTE format(
          'ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL',
          t
        );
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not SET NOT NULL on %.%: %', t, 'organization_id', SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_org_role_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_org_role_chk CHECK (
    (role = 'super_admin' AND organization_id IS NULL)
    OR (role <> 'super_admin' AND organization_id IS NOT NULL)
  );


-- ============================================================
-- G. Unique codes are per-organization (not global)
-- ============================================================

ALTER TABLE public.companies         DROP CONSTRAINT IF EXISTS companies_code_key;
ALTER TABLE public.teams             DROP CONSTRAINT IF EXISTS teams_code_key;
ALTER TABLE public.clients           DROP CONSTRAINT IF EXISTS clients_code_key;
ALTER TABLE public.projects          DROP CONSTRAINT IF EXISTS projects_code_key;
ALTER TABLE public.tactics           DROP CONSTRAINT IF EXISTS tactics_code_key;
ALTER TABLE public.tactic_documents  DROP CONSTRAINT IF EXISTS tactic_documents_code_key;
ALTER TABLE public.profiles          DROP CONSTRAINT IF EXISTS profiles_employee_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS companies_org_code_uidx
  ON public.companies (organization_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS teams_org_code_uidx
  ON public.teams (organization_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS clients_org_code_uidx
  ON public.clients (organization_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS projects_org_code_uidx
  ON public.projects (organization_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS tactics_org_code_uidx
  ON public.tactics (organization_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS tactic_documents_org_code_uidx
  ON public.tactic_documents (organization_id, code);

-- Tenant employee codes unique inside the workspace
CREATE UNIQUE INDEX IF NOT EXISTS profiles_org_employee_code_uidx
  ON public.profiles (organization_id, employee_code)
  WHERE organization_id IS NOT NULL;

-- Super Admin codes unique among platform users
CREATE UNIQUE INDEX IF NOT EXISTS profiles_sa_employee_code_uidx
  ON public.profiles (employee_code)
  WHERE organization_id IS NULL;


-- ============================================================
-- H. Per-org auto-codes (EMP001 of Org A ≠ EMP001 of Org B)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.org_code_counters (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prefix          text NOT NULL,
  last_value      bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, prefix)
);

CREATE OR REPLACE FUNCTION public.next_org_code(
  p_org_id uuid,
  p_prefix text,
  p_pad    int DEFAULT 3
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  n bigint;
BEGIN
  IF p_org_id IS NULL THEN
    -- Platform user (super_admin): keep using the global EMP sequence
    RETURN public.fmt_code(p_prefix, nextval('public.seq_emp_code'), p_pad);
  END IF;

  INSERT INTO public.org_code_counters (organization_id, prefix, last_value)
  VALUES (p_org_id, p_prefix, 1)
  ON CONFLICT (organization_id, prefix)
  DO UPDATE SET last_value = public.org_code_counters.last_value + 1
  RETURNING last_value INTO n;

  RETURN public.fmt_code(p_prefix, n, p_pad);
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_set_employee_code()
  RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  IF NEW.employee_code IS NULL OR trim(NEW.employee_code) = '' THEN
    NEW.employee_code := public.next_org_code(NEW.organization_id, 'EMP');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_set_company_code()
  RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  IF NEW.code IS NULL OR trim(NEW.code) = '' THEN
    NEW.code := public.next_org_code(NEW.organization_id, 'TLB');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_set_client_code()
  RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  IF NEW.code IS NULL OR trim(NEW.code) = '' THEN
    NEW.code := public.next_org_code(NEW.organization_id, 'CLI');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_set_project_code()
  RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  IF NEW.code IS NULL OR trim(NEW.code) = '' THEN
    NEW.code := public.next_org_code(NEW.organization_id, 'PRJ');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_set_tactic_code()
  RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  IF NEW.code IS NULL OR trim(NEW.code) = '' THEN
    NEW.code := public.next_org_code(NEW.organization_id, 'TAC');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_set_tdoc_code()
  RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  IF NEW.code IS NULL OR trim(NEW.code) = '' THEN
    NEW.code := public.next_org_code(NEW.organization_id, 'TDOC');
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================================
-- I. Auto-stamp organization_id from the logged-in user
--    (existing server actions keep working without code changes)
-- ============================================================

CREATE OR REPLACE FUNCTION public._trg_stamp_organization_id()
  RETURNS trigger LANGUAGE plpgsql
  SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'profiles' THEN
      IF NEW.role = 'super_admin' THEN
        NEW.organization_id := NULL;
        RETURN NEW;
      END IF;
    END IF;

    -- Tenants cannot move a row to another workspace
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
       AND NOT public.is_super_admin() THEN
      NEW.organization_id := OLD.organization_id;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.organization_id IS NULL AND TG_TABLE_NAME <> 'profiles' THEN
    NEW.organization_id := public.get_my_org_id();
  END IF;

  IF TG_TABLE_NAME = 'profiles' THEN
    IF NEW.role = 'super_admin' THEN
      NEW.organization_id := NULL;
    ELSIF NEW.organization_id IS NULL THEN
      NEW.organization_id := public.get_my_org_id();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'profiles',
    'companies',
    'teams',
    'employee_companies',
    'clients',
    'projects',
    'tactics',
    'tactic_assignees',
    'activity_logs',
    'time_logs',
    'documents',
    'notifications',
    'announcements',
    'employee_work_sheets',
    'employee_work_sheet_folders',
    'employee_work_sheet_shares',
    'employee_work_sheet_folder_shares',
    'tactic_documents',
    'tactic_tasks',
    'tactic_next_steps',
    'tactic_document_shares',
    'leads',
    'lead_assignments',
    'leave_requests',
    'training_modules',
    'training_questions',
    'training_progress',
    'mcp_connection_tokens'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_00_stamp_organization_id ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_00_stamp_organization_id BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public._trg_stamp_organization_id()',
        t
      );
    END IF;
  END LOOP;
END $$;


-- ============================================================
-- J. Profile auto-create on auth.users — carry org + role from metadata
-- ============================================================

CREATE OR REPLACE FUNCTION public._trg_create_profile_on_signup()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  meta_role public.user_role;
  meta_org  uuid;
BEGIN
  BEGIN
    meta_role := COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.user_role,
      'employee'
    );
  EXCEPTION WHEN invalid_text_representation THEN
    meta_role := 'employee';
  END;

  meta_org := NULLIF(NEW.raw_user_meta_data->>'organization_id', '')::uuid;

  IF meta_role = 'super_admin' THEN
    meta_org := NULL;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, status, organization_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    meta_role,
    'active',
    meta_org
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;


-- ============================================================
-- K. Seed per-org counters from existing max codes so new rows don't collide
-- ============================================================

DO $$
DECLARE
  default_org uuid;
BEGIN
  SELECT id INTO default_org FROM public.organizations WHERE slug = 'default' LIMIT 1;
  IF default_org IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.org_code_counters (organization_id, prefix, last_value)
  VALUES
    (default_org, 'EMP',  COALESCE((SELECT max(substring(employee_code from '\d+$')::bigint) FROM public.profiles WHERE organization_id = default_org AND employee_code ~ '^EMP[0-9]+$'), 0)),
    (default_org, 'TLB',  COALESCE((SELECT max(substring(code from '\d+$')::bigint) FROM public.companies WHERE organization_id = default_org AND code ~ '^[A-Z]+[0-9]+$'), 0)),
    (default_org, 'CLI',  COALESCE((SELECT max(substring(code from '\d+$')::bigint) FROM public.clients WHERE organization_id = default_org AND code ~ '^CLI[0-9]+$'), 0)),
    (default_org, 'PRJ',  COALESCE((SELECT max(substring(code from '\d+$')::bigint) FROM public.projects WHERE organization_id = default_org AND code ~ '^PRJ[0-9]+$'), 0)),
    (default_org, 'TAC',  COALESCE((SELECT max(substring(code from '\d+$')::bigint) FROM public.tactics WHERE organization_id = default_org AND code ~ '^TAC[0-9]+$'), 0)),
    (default_org, 'TDOC', COALESCE((SELECT max(substring(code from '\d+$')::bigint) FROM public.tactic_documents WHERE organization_id = default_org AND code ~ '^TDOC[0-9]+$'), 0))
  ON CONFLICT (organization_id, prefix) DO NOTHING;
END $$;
