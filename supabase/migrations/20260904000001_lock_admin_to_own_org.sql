-- =============================================================================
-- WSSO SaaS 10 — Lock every workspace admin to their own organization
--
-- Bug: policies like tactics_admin_all used `get_my_role() = 'admin'` with no
-- organization check. Any company admin could SELECT (and write) every tenant's
-- work orders, people, and related rows.
--
-- This file is safe to re-run. Apply in Supabase SQL editor if this database
-- was not created from the latest migrations.
-- =============================================================================

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
GRANT EXECUTE ON FUNCTION public.get_my_org_id()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.same_org(uuid)   TO authenticated;

-- Backfill work orders that never got an organization_id (creator's workspace).
UPDATE public.tactics t
SET organization_id = p.organization_id
FROM public.profiles p
WHERE t.created_by = p.id
  AND t.organization_id IS NULL
  AND p.organization_id IS NOT NULL;

UPDATE public.tactic_assignees ta
SET organization_id = t.organization_id
FROM public.tactics t
WHERE ta.tactic_id = t.id
  AND ta.organization_id IS NULL
  AND t.organization_id IS NOT NULL;

-- Restrictive isolation: even an "admin" policy cannot cross workspaces.
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
      IF t = 'profiles' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (id = auth.uid() OR public.same_org(organization_id)) WITH CHECK (id = auth.uid() OR public.same_org(organization_id))',
          pol, t
        );
      ELSE
        EXECUTE format(
          'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.same_org(organization_id)) WITH CHECK (public.same_org(organization_id))',
          pol, t
        );
      END IF;
    END IF;
  END LOOP;
END $$;

-- Belt-and-suspenders: role policies themselves must name the workspace.
-- Tactics (reported leak)
DROP POLICY IF EXISTS "tactics_admin_all" ON public.tactics;
CREATE POLICY "tactics_admin_all" ON public.tactics
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "tactics_director_select" ON public.tactics;
CREATE POLICY "tactics_director_select" ON public.tactics
  FOR SELECT TO authenticated
  USING (get_my_role() = 'director' AND public.same_org(organization_id));

-- People / org structure
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND (id = auth.uid() OR public.same_org(organization_id)))
  WITH CHECK(get_my_role() = 'admin' AND (id = auth.uid() OR public.same_org(organization_id)));

DROP POLICY IF EXISTS "profiles_director_select" ON public.profiles;
CREATE POLICY "profiles_director_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (get_my_role() = 'director' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "profiles_manager_select" ON public.profiles;
CREATE POLICY "profiles_manager_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (get_my_role() = 'manager' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "companies_admin_all" ON public.companies;
CREATE POLICY "companies_admin_all" ON public.companies
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "teams_admin_all" ON public.teams;
CREATE POLICY "teams_admin_all" ON public.teams
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "ec_admin_all" ON public.employee_companies;
CREATE POLICY "ec_admin_all" ON public.employee_companies
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "clients_admin_all" ON public.clients;
CREATE POLICY "clients_admin_all" ON public.clients
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "projects_admin_all" ON public.projects;
CREATE POLICY "projects_admin_all" ON public.projects
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "al_admin_all" ON public.activity_logs;
CREATE POLICY "al_admin_all" ON public.activity_logs
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "tl_admin_all" ON public.time_logs;
CREATE POLICY "tl_admin_all" ON public.time_logs
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "docs_admin_all" ON public.documents;
CREATE POLICY "docs_admin_all" ON public.documents
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "ta_admin_all" ON public.tactic_assignees;
CREATE POLICY "ta_admin_all" ON public.tactic_assignees
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

-- Director / extra admin tables that still used role-only checks
DROP POLICY IF EXISTS "tdoc_admin_all" ON public.tactic_documents;
CREATE POLICY "tdoc_admin_all" ON public.tactic_documents
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "ttask_admin_all" ON public.tactic_tasks;
CREATE POLICY "ttask_admin_all" ON public.tactic_tasks
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "tns_admin_all" ON public.tactic_next_steps;
CREATE POLICY "tns_admin_all" ON public.tactic_next_steps
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "tdshare_admin_all" ON public.tactic_document_shares;
CREATE POLICY "tdshare_admin_all" ON public.tactic_document_shares
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "leads_admin_all" ON public.leads;
CREATE POLICY "leads_admin_all" ON public.leads
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "la_admin_all" ON public.lead_assignments;
CREATE POLICY "la_admin_all" ON public.lead_assignments
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "lr_admin_all" ON public.leave_requests;
CREATE POLICY "lr_admin_all" ON public.leave_requests
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "ann_admin_all" ON public.announcements;
CREATE POLICY "ann_admin_all" ON public.announcements
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "notif_admin_all" ON public.notifications;
CREATE POLICY "notif_admin_all" ON public.notifications
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "tm_admin_all" ON public.training_modules;
CREATE POLICY "tm_admin_all" ON public.training_modules
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "tq_admin_all" ON public.training_questions;
CREATE POLICY "tq_admin_all" ON public.training_questions
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin' AND public.same_org(organization_id))
  WITH CHECK(get_my_role() = 'admin' AND public.same_org(organization_id));

-- Work-order manager/employee policies must stay inside the workspace too.
DROP POLICY IF EXISTS "tactics_manager_insert" ON public.tactics;
CREATE POLICY "tactics_manager_insert" ON public.tactics
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'manager' AND public.same_org(organization_id));

DROP POLICY IF EXISTS "tactics_delete_creator" ON public.tactics;
CREATE POLICY "tactics_delete_creator" ON public.tactics
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND public.same_org(organization_id));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tactic_has_team_assignee') THEN
    EXECUTE 'DROP POLICY IF EXISTS "tactics_manager_select" ON public.tactics';
    EXECUTE $p$
      CREATE POLICY "tactics_manager_select" ON public.tactics
        FOR SELECT TO authenticated
        USING (
          get_my_role() = 'manager'
          AND public.same_org(organization_id)
          AND (created_by = auth.uid() OR tactic_has_team_assignee(id))
        )
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS "tactics_manager_update" ON public.tactics';
    EXECUTE $p$
      CREATE POLICY "tactics_manager_update" ON public.tactics
        FOR UPDATE TO authenticated
        USING (
          get_my_role() = 'manager'
          AND public.same_org(organization_id)
          AND (created_by = auth.uid() OR tactic_has_team_assignee(id))
        )
        WITH CHECK (
          get_my_role() = 'manager'
          AND public.same_org(organization_id)
          AND (created_by = auth.uid() OR tactic_has_team_assignee(id))
        )
    $p$;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_assignee_of_tactic') THEN
    EXECUTE 'DROP POLICY IF EXISTS "tactics_employee_select" ON public.tactics';
    EXECUTE $p$
      CREATE POLICY "tactics_employee_select" ON public.tactics
        FOR SELECT TO authenticated
        USING (
          get_my_role() = 'employee'
          AND public.same_org(organization_id)
          AND is_assignee_of_tactic(id)
        )
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS "tactics_employee_update" ON public.tactics';
    EXECUTE $p$
      CREATE POLICY "tactics_employee_update" ON public.tactics
        FOR UPDATE TO authenticated
        USING (
          get_my_role() = 'employee'
          AND public.same_org(organization_id)
          AND is_assignee_of_tactic(id)
        )
        WITH CHECK (
          get_my_role() = 'employee'
          AND public.same_org(organization_id)
          AND is_assignee_of_tactic(id)
        )
    $p$;
  END IF;
END $$;

