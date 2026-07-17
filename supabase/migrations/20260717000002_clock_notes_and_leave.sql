-- =============================================================================
-- 1. Clock-in / clock-out notes on time_logs, with manager/admin approval.
--    Note field is always optional — if the employee adds one (e.g. explaining
--    a late clock-in or early clock-out), it starts 'pending' until a
--    manager/admin approves or rejects it.
--
-- Safe to re-run: every statement below is guarded (DO block for the enum,
-- IF NOT EXISTS everywhere else, DROP POLICY IF EXISTS before CREATE POLICY).
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.note_review_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.time_logs
  ADD COLUMN IF NOT EXISTS clock_in_note         text,
  ADD COLUMN IF NOT EXISTS clock_in_note_status  public.note_review_status,
  ADD COLUMN IF NOT EXISTS clock_out_note        text,
  ADD COLUMN IF NOT EXISTS clock_out_note_status public.note_review_status;

COMMENT ON COLUMN public.time_logs.clock_in_note_status  IS 'NULL when no note was left; pending/approved/rejected once one is.';
COMMENT ON COLUMN public.time_logs.clock_out_note_status IS 'NULL when no note was left; pending/approved/rejected once one is.';

CREATE INDEX IF NOT EXISTS idx_tl_clock_in_note_pending
  ON public.time_logs(employee_id) WHERE clock_in_note_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tl_clock_out_note_pending
  ON public.time_logs(employee_id) WHERE clock_out_note_status = 'pending';

-- Note approval itself is done server-side with the service-role client
-- (mirrors forceClockOut) and audited via activity_logs, so no new RLS
-- policies are needed on time_logs — the existing owner/manager/admin
-- policies already cover reading/writing these new columns on the row.

-- =============================================================================
-- 2. Leave requests — date range (or half day), reason, manager/admin approval.
--    Approved leave is checked live by the app (ClockWidget, dashboards) to
--    show "On leave" instead of a missing/incomplete time log.
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.half_day_period AS ENUM ('morning', 'afternoon');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id               uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      uuid              NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date       date              NOT NULL,
  end_date         date              NOT NULL,
  half_day         boolean           NOT NULL DEFAULT false,
  half_day_period  public.half_day_period,
  reason           text              NOT NULL,
  status           public.leave_status NOT NULL DEFAULT 'pending',
  reviewed_by      uuid              REFERENCES public.profiles(id),
  reviewed_at      timestamptz,
  review_note      text,
  created_at       timestamptz       NOT NULL DEFAULT now(),

  CONSTRAINT leave_requests_date_chk
    CHECK (end_date >= start_date),
  CONSTRAINT leave_requests_half_day_chk
    CHECK (NOT half_day OR (start_date = end_date AND half_day_period IS NOT NULL))
);

COMMENT ON TABLE public.leave_requests IS
  'Employee leave/time-off requests with manager or admin approval.';

CREATE INDEX IF NOT EXISTS idx_lr_employee_id ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_lr_status      ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_lr_date_range  ON public.leave_requests(start_date, end_date);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Admin: full access
DROP POLICY IF EXISTS "lr_admin_all" ON public.leave_requests;
CREATE POLICY "lr_admin_all" ON public.leave_requests
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

-- Director: read-only visibility, same as time_logs
DROP POLICY IF EXISTS "lr_director_select" ON public.leave_requests;
CREATE POLICY "lr_director_select" ON public.leave_requests
  FOR SELECT TO authenticated
  USING (get_my_role() = 'director');

-- Manager: view + approve/reject requests from their own team
DROP POLICY IF EXISTS "lr_manager_select" ON public.leave_requests;
CREATE POLICY "lr_manager_select" ON public.leave_requests
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'manager'
    AND employee_id IN (SELECT id FROM public.profiles WHERE team_id = get_my_team_id())
  );

DROP POLICY IF EXISTS "lr_manager_update" ON public.leave_requests;
CREATE POLICY "lr_manager_update" ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'manager'
    AND employee_id IN (SELECT id FROM public.profiles WHERE team_id = get_my_team_id())
  )
  WITH CHECK (
    get_my_role() = 'manager'
    AND employee_id IN (SELECT id FROM public.profiles WHERE team_id = get_my_team_id())
  );

-- Employee (any role): request leave for themselves, see their own requests,
-- withdraw while still pending. Cannot self-approve — no UPDATE-to-approve policy.
DROP POLICY IF EXISTS "lr_self_insert" ON public.leave_requests;
CREATE POLICY "lr_self_insert" ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "lr_self_select" ON public.leave_requests;
CREATE POLICY "lr_self_select" ON public.leave_requests
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "lr_self_delete_pending" ON public.leave_requests;
CREATE POLICY "lr_self_delete_pending" ON public.leave_requests
  FOR DELETE TO authenticated
  USING (employee_id = auth.uid() AND status = 'pending');

-- Refresh PostgREST schema cache so the API sees the new table/columns immediately
NOTIFY pgrst, 'reload schema';
