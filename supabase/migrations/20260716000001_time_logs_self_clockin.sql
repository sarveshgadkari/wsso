-- =============================================================================
-- Allow director and manager roles to clock themselves in/out.
-- Admin already has an unrestricted FOR ALL policy (tl_admin_all), so no
-- change needed there. Employee self-access already exists (tl_employee_own).
-- =============================================================================

CREATE POLICY "tl_director_own" ON public.time_logs
  FOR ALL TO authenticated
  USING     (get_my_role() = 'director' AND employee_id = auth.uid())
  WITH CHECK(get_my_role() = 'director' AND employee_id = auth.uid());

CREATE POLICY "tl_manager_own" ON public.time_logs
  FOR ALL TO authenticated
  USING     (get_my_role() = 'manager' AND employee_id = auth.uid())
  WITH CHECK(get_my_role() = 'manager' AND employee_id = auth.uid());
