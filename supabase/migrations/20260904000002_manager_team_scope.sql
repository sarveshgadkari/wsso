-- =============================================================================
-- WSSO SaaS 11 — Managers see only their own team
--
-- Bug: profiles_manager_select allowed any manager to SELECT every profile in
-- the workspace. Employees, Team Time, and assignee pickers then showed the
-- whole company.
--
-- A manager may see: themselves, people on teams they manage, and people whose
-- manager_id is them. Admin still sees the whole workspace.
--
-- Safe to re-run. Apply in Supabase SQL editor after saas/10.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_on_my_team(p_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT
    p_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = p_id
        AND (
          p.manager_id = auth.uid()
          OR p.team_id IN (SELECT t.id FROM public.teams t WHERE t.manager_id = auth.uid())
          OR (
            p.team_id IS NOT NULL
            AND p.team_id = (SELECT me.team_id FROM public.profiles me WHERE me.id = auth.uid())
          )
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_on_my_team(uuid) TO authenticated;

DROP POLICY IF EXISTS "profiles_manager_select" ON public.profiles;
CREATE POLICY "profiles_manager_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'manager'
    AND public.same_org(organization_id)
    AND public.is_on_my_team(id)
  );

DROP POLICY IF EXISTS "profiles_manager_write" ON public.profiles;
CREATE POLICY "profiles_manager_write" ON public.profiles
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'manager'
    AND public.same_org(organization_id)
    AND public.is_on_my_team(id)
    AND id <> auth.uid()
  )
  WITH CHECK (
    get_my_role() = 'manager'
    AND public.same_org(organization_id)
    AND public.is_on_my_team(id)
  );

-- Managers only list teams they lead or belong to (directors still see all in-org).
DROP POLICY IF EXISTS "teams_director_manager_select" ON public.teams;
DROP POLICY IF EXISTS "teams_director_select" ON public.teams;
DROP POLICY IF EXISTS "teams_manager_select" ON public.teams;

CREATE POLICY "teams_director_select" ON public.teams
  FOR SELECT TO authenticated
  USING (get_my_role() = 'director' AND public.same_org(organization_id));

CREATE POLICY "teams_manager_select" ON public.teams
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'manager'
    AND public.same_org(organization_id)
    AND (
      manager_id = auth.uid()
      OR id = public.get_my_team_id()
    )
  );

-- Leave / time / files: same team rule (not only get_my_team_id()).
DROP POLICY IF EXISTS "lr_manager_select" ON public.leave_requests;
CREATE POLICY "lr_manager_select" ON public.leave_requests
  FOR SELECT TO authenticated
  USING (get_my_role() = 'manager' AND public.is_on_my_team(employee_id));

DROP POLICY IF EXISTS "lr_manager_update" ON public.leave_requests;
CREATE POLICY "lr_manager_update" ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'manager' AND public.is_on_my_team(employee_id))
  WITH CHECK (get_my_role() = 'manager' AND public.is_on_my_team(employee_id));

DROP POLICY IF EXISTS "docs_manager_all" ON public.documents;
CREATE POLICY "docs_manager_all" ON public.documents
  FOR ALL TO authenticated
  USING (get_my_role() = 'manager' AND public.is_on_my_team(uploaded_by))
  WITH CHECK (get_my_role() = 'manager' AND public.is_on_my_team(uploaded_by));

DROP POLICY IF EXISTS "tl_manager_all" ON public.time_logs;
CREATE POLICY "tl_manager_all" ON public.time_logs
  FOR ALL TO authenticated
  USING (get_my_role() = 'manager' AND public.is_on_my_team(employee_id))
  WITH CHECK (get_my_role() = 'manager' AND public.is_on_my_team(employee_id));

DROP POLICY IF EXISTS "al_manager_all" ON public.activity_logs;
CREATE POLICY "al_manager_all" ON public.activity_logs
  FOR ALL TO authenticated
  USING (get_my_role() = 'manager' AND public.is_on_my_team(employee_id))
  WITH CHECK (get_my_role() = 'manager' AND public.is_on_my_team(employee_id));

-- Work orders: assignee is on a team this manager leads, not only get_my_team_id().
CREATE OR REPLACE FUNCTION public.tactic_has_team_assignee(p_tactic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.tactic_assignees ta
    JOIN   public.profiles p ON p.id = ta.profile_id
    WHERE  ta.tactic_id = p_tactic_id
    AND    public.is_on_my_team(p.id)
  )
  OR EXISTS (
    SELECT 1
    FROM   public.tactics t
    JOIN   public.profiles p ON p.id = t.assigned_to
    WHERE  t.id = p_tactic_id
    AND    public.is_on_my_team(p.id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.tactic_has_team_assignee(uuid) TO authenticated;
