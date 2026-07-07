-- Managers can read activity logs for any work order they already have access to
-- (created by them or assigned to their team), not only when employee_id matches team.
CREATE POLICY "al_manager_tactic_select" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'manager'
    AND tactic_id IN (
      SELECT t.id
      FROM public.tactics t
      WHERE t.created_by = auth.uid()
         OR t.assigned_to IN (
           SELECT p.id FROM public.profiles p
           WHERE p.team_id = get_my_team_id()
         )
    )
  );
