-- Employees can read all activity on work orders assigned to them
-- (including manager send-back feedback), not only their own entries.
CREATE POLICY "al_employee_tactic_select" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'employee'
    AND tactic_id IN (
      SELECT t.id FROM public.tactics t WHERE t.assigned_to = auth.uid()
    )
  );
