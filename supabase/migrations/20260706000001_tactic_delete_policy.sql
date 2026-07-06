-- Restrict work order deletion to admin or creator only.
-- Existing manager/employee FOR ALL policies also allowed DELETE.

DROP POLICY IF EXISTS "tactics_manager_all" ON public.tactics;
DROP POLICY IF EXISTS "tactics_employee_own" ON public.tactics;

CREATE POLICY "tactics_manager_select" ON public.tactics
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'manager'
    AND (
      created_by = auth.uid()
      OR assigned_to IN (
        SELECT id FROM public.profiles WHERE team_id = get_my_team_id()
      )
    )
  );

CREATE POLICY "tactics_manager_insert" ON public.tactics
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'manager'
    AND created_by = auth.uid()
  );

CREATE POLICY "tactics_manager_update" ON public.tactics
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'manager'
    AND (
      created_by = auth.uid()
      OR assigned_to IN (
        SELECT id FROM public.profiles WHERE team_id = get_my_team_id()
      )
    )
  )
  WITH CHECK (
    get_my_role() = 'manager'
    AND (
      created_by = auth.uid()
      OR assigned_to IN (
        SELECT id FROM public.profiles WHERE team_id = get_my_team_id()
      )
    )
  );

CREATE POLICY "tactics_employee_select" ON public.tactics
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'employee'
    AND assigned_to = auth.uid()
  );

CREATE POLICY "tactics_employee_update" ON public.tactics
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'employee'
    AND assigned_to = auth.uid()
  )
  WITH CHECK (
    get_my_role() = 'employee'
    AND assigned_to = auth.uid()
  );

-- Admin already has tactics_admin_all (FOR ALL). Creators may delete their own work orders.
CREATE POLICY "tactics_delete_creator" ON public.tactics
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());
