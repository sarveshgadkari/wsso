-- Multi-assignee work orders: same tactic shared by multiple people.
-- Keep tactics.assigned_to as the primary assignee (first selected) for backward compatibility.

CREATE TABLE IF NOT EXISTS public.tactic_assignees (
  tactic_id   uuid NOT NULL REFERENCES public.tactics(id)  ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tactic_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_tactic_assignees_profile
  ON public.tactic_assignees(profile_id);

COMMENT ON TABLE public.tactic_assignees IS
  'People assigned to a work order. One tactic can have many assignees.';

-- Backfill existing single assignees
INSERT INTO public.tactic_assignees (tactic_id, profile_id)
SELECT id, assigned_to
FROM   public.tactics
ON CONFLICT DO NOTHING;

-- ── Helpers (SECURITY DEFINER so RLS can use junction without recursion) ──

CREATE OR REPLACE FUNCTION public.is_assignee_of_tactic(p_tactic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.tactic_assignees
    WHERE  tactic_id  = p_tactic_id
    AND    profile_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM   public.tactics
    WHERE  id = p_tactic_id
    AND    assigned_to = auth.uid()
  );
$$;

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
    AND    p.team_id = get_my_team_id()
  )
  OR EXISTS (
    SELECT 1
    FROM   public.tactics t
    JOIN   public.profiles p ON p.id = t.assigned_to
    WHERE  t.id = p_tactic_id
    AND    p.team_id = get_my_team_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_assignee_of_tactic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tactic_has_team_assignee(uuid) TO authenticated;

-- ── RLS on tactic_assignees ──────────────────────────────────

ALTER TABLE public.tactic_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ta_admin_all" ON public.tactic_assignees;
CREATE POLICY "ta_admin_all" ON public.tactic_assignees
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

DROP POLICY IF EXISTS "ta_director_select" ON public.tactic_assignees;
CREATE POLICY "ta_director_select" ON public.tactic_assignees
  FOR SELECT TO authenticated
  USING (get_my_role() = 'director');

DROP POLICY IF EXISTS "ta_manager_all" ON public.tactic_assignees;
CREATE POLICY "ta_manager_all" ON public.tactic_assignees
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'manager'
    AND (
      EXISTS (
        SELECT 1 FROM public.tactics t
        WHERE t.id = tactic_id AND t.created_by = auth.uid()
      )
      OR tactic_has_team_assignee(tactic_id)
    )
  )
  WITH CHECK (
    get_my_role() = 'manager'
    AND (
      EXISTS (
        SELECT 1 FROM public.tactics t
        WHERE t.id = tactic_id AND t.created_by = auth.uid()
      )
      OR get_my_role() = 'manager'
    )
  );

DROP POLICY IF EXISTS "ta_employee_select" ON public.tactic_assignees;
CREATE POLICY "ta_employee_select" ON public.tactic_assignees
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'employee'
    AND is_assignee_of_tactic(tactic_id)
  );

-- ── Broaden tactics employee / manager policies ──────────────

DROP POLICY IF EXISTS "tactics_employee_select" ON public.tactics;
CREATE POLICY "tactics_employee_select" ON public.tactics
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'employee'
    AND is_assignee_of_tactic(id)
  );

DROP POLICY IF EXISTS "tactics_employee_update" ON public.tactics;
CREATE POLICY "tactics_employee_update" ON public.tactics
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'employee'
    AND is_assignee_of_tactic(id)
  )
  WITH CHECK (
    get_my_role() = 'employee'
    AND is_assignee_of_tactic(id)
  );

DROP POLICY IF EXISTS "tactics_manager_select" ON public.tactics;
CREATE POLICY "tactics_manager_select" ON public.tactics
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'manager'
    AND (
      created_by = auth.uid()
      OR tactic_has_team_assignee(id)
    )
  );

DROP POLICY IF EXISTS "tactics_manager_update" ON public.tactics;
CREATE POLICY "tactics_manager_update" ON public.tactics
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'manager'
    AND (
      created_by = auth.uid()
      OR tactic_has_team_assignee(id)
    )
  )
  WITH CHECK (
    get_my_role() = 'manager'
    AND (
      created_by = auth.uid()
      OR tactic_has_team_assignee(id)
    )
  );
