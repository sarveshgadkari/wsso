-- =============================================================================
-- WSSO SaaS 03 — Tenant isolation (restrictive RLS)
-- Run AFTER 02_organizations_and_tenant_columns.sql
--
-- How this works:
--   PostgreSQL RLS = (any PERMISSIVE policy passes) AND (all RESTRICTIVE pass)
--   Existing role policies stay PERMISSIVE (admin/manager/employee rules).
--   One new RESTRICTIVE policy per table: same workspace, or Super Admin.
--   Result: an Org A admin cannot see Org B, even though they are "admin".
-- =============================================================================

-- Recreate helpers here so 03 still works if 02 rolled back mid-script.
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

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.same_org(uuid)  TO authenticated;


-- ============================================================
-- A. organizations
-- ============================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orgs_member_select" ON public.organizations;
CREATE POLICY "orgs_member_select" ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.get_my_org_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "orgs_super_admin_all" ON public.organizations;
CREATE POLICY "orgs_super_admin_all" ON public.organizations
  FOR ALL TO authenticated
  USING     (public.is_super_admin())
  WITH CHECK(public.is_super_admin());


-- ============================================================
-- B. org_code_counters — no client access (triggers use SECURITY DEFINER)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'org_code_counters'
  ) THEN
    ALTER TABLE public.org_code_counters ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;


-- ============================================================
-- C. Restrictive tenant isolation on every business table
-- ============================================================

DO $$
DECLARE
  t text;
  pol text;
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
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id'
    ) THEN
      pol := t || '_tenant_isolation';
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.same_org(organization_id)) WITH CHECK (public.same_org(organization_id))',
        pol, t
      );
    END IF;
  END LOOP;
END $$;


-- ============================================================
-- D. Super Admin may SELECT across tenants (platform console)
--    Writes to tenant data still go through service role on the server.
-- ============================================================

DO $$
DECLARE
  t text;
  pol text;
  tables text[] := ARRAY[
    'profiles',
    'companies',
    'teams',
    'tactics',
    'time_logs',
    'leads',
    'leave_requests',
    'training_modules'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      pol := t || '_super_admin_select';
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_super_admin())',
        pol, t
      );
    END IF;
  END LOOP;
END $$;


-- ============================================================
-- E. Org admins cannot see Super Admin rows
--    (same_org(NULL) is false for tenants; Super Admin still sees own row
--     via profiles_employee_own which matches id = auth.uid())
-- ============================================================

-- Done. Isolation proof after this file:
--   1. Create Org B in /platform
--   2. Log in as Org B admin
--   3. SELECT * FROM companies  → only Org B
--   4. Log in as original admin → only default workspace
