-- Daily work log for direct employees, 1099s, and subcontractors.
-- Safe to re-run. Apply in the Supabase SQL editor (also saved as saas/13_daily_work.sql).

CREATE TABLE IF NOT EXISTS public.daily_work_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_date        date NOT NULL,
  worker_type      text NOT NULL DEFAULT 'direct'
                     CHECK (worker_type IN ('direct', '1099', 'subcontractor')),
  category         text NOT NULL
                     CHECK (category IN (
                       'admin', 'operations', 'social_media', 'marketing',
                       'business_development', 'sales', 'it',
                       'product_development', 'executive'
                     )),
  product          text,
  product_detail   text,
  executive_role   text,
  task             text NOT NULL,
  start_time       time NOT NULL,
  end_time         time NOT NULL,
  hours            numeric(6, 2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  notes            text,
  status           text NOT NULL DEFAULT 'submitted'
                     CHECK (status IN ('submitted', 'done')),
  reviewed_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS daily_work_org_date_idx
  ON public.daily_work_entries (organization_id, work_date DESC);

CREATE INDEX IF NOT EXISTS daily_work_employee_date_idx
  ON public.daily_work_entries (employee_id, work_date DESC);

DROP TRIGGER IF EXISTS trg_daily_work_updated_at ON public.daily_work_entries;
CREATE TRIGGER trg_daily_work_updated_at
  BEFORE UPDATE ON public.daily_work_entries
  FOR EACH ROW EXECUTE FUNCTION public._trg_set_updated_at();

-- True when the signed-in manager may review this person:
-- employees on their team or reporting to them. Never other managers.
CREATE OR REPLACE FUNCTION public.daily_work_target_is_my_employee(p_employee uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_employee
      AND p.role = 'employee'
      AND p.id <> auth.uid()
      AND (
        p.manager_id = auth.uid()
        OR p.team_id IN (SELECT t.id FROM public.teams t WHERE t.manager_id = auth.uid())
      )
  );
$$;

REVOKE ALL ON FUNCTION public.daily_work_target_is_my_employee(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.daily_work_target_is_my_employee(uuid) TO authenticated;

ALTER TABLE public.daily_work_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_work_select" ON public.daily_work_entries;
CREATE POLICY "daily_work_select" ON public.daily_work_entries
  FOR SELECT TO authenticated
  USING (
    public.same_org(organization_id)
    AND (
      employee_id = auth.uid()
      OR get_my_role() = 'admin'
      OR (
        get_my_role() = 'manager'
        AND public.daily_work_target_is_my_employee(employee_id)
      )
    )
  );

DROP POLICY IF EXISTS "daily_work_insert_own" ON public.daily_work_entries;
CREATE POLICY "daily_work_insert_own" ON public.daily_work_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    AND status = 'submitted'
    AND public.same_org(organization_id)
  );

DROP POLICY IF EXISTS "daily_work_update_own" ON public.daily_work_entries;
CREATE POLICY "daily_work_update_own" ON public.daily_work_entries
  FOR UPDATE TO authenticated
  USING (
    employee_id = auth.uid()
    AND status = 'submitted'
    AND public.same_org(organization_id)
  )
  WITH CHECK (
    employee_id = auth.uid()
    AND status = 'submitted'
    AND public.same_org(organization_id)
  );

DROP POLICY IF EXISTS "daily_work_review" ON public.daily_work_entries;
CREATE POLICY "daily_work_review" ON public.daily_work_entries
  FOR UPDATE TO authenticated
  USING (
    public.same_org(organization_id)
    AND (
      get_my_role() = 'admin'
      OR (
        get_my_role() = 'manager'
        AND public.daily_work_target_is_my_employee(employee_id)
      )
    )
  )
  WITH CHECK (
    public.same_org(organization_id)
    AND (
      get_my_role() = 'admin'
      OR (
        get_my_role() = 'manager'
        AND public.daily_work_target_is_my_employee(employee_id)
      )
    )
  );

DROP POLICY IF EXISTS "daily_work_delete_own" ON public.daily_work_entries;
CREATE POLICY "daily_work_delete_own" ON public.daily_work_entries
  FOR DELETE TO authenticated
  USING (
    public.same_org(organization_id)
    AND (
      (employee_id = auth.uid() AND status = 'submitted')
      OR get_my_role() = 'admin'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_work_entries TO authenticated;

NOTIFY pgrst, 'reload schema';
