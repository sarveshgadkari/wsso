-- =============================================================================
-- Per-employee timezone for time tracking (IST, CST, etc.)
-- log_date is derived from clock_in_at in the employee's local calendar day.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata';

COMMENT ON COLUMN public.profiles.timezone IS
  'IANA timezone for this employee (e.g. Asia/Kolkata, America/Chicago). Used for log_date and daily time boundaries.';

-- Recalculate log_date using the employee timezone
CREATE OR REPLACE FUNCTION public._trg_calc_duration()
  RETURNS trigger LANGUAGE plpgsql AS
$$
DECLARE
  emp_tz text;
BEGIN
  SELECT COALESCE(timezone, 'UTC') INTO emp_tz
  FROM public.profiles
  WHERE id = NEW.employee_id;

  NEW.log_date := (NEW.clock_in_at AT TIME ZONE emp_tz)::date;

  IF NEW.clock_out_at IS NOT NULL THEN
    NEW.duration_minutes :=
      EXTRACT(EPOCH FROM (NEW.clock_out_at - NEW.clock_in_at))::integer / 60;
  ELSE
    NEW.duration_minutes := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill existing rows after timezone column is populated
UPDATE public.time_logs tl
SET log_date = (tl.clock_in_at AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date
FROM public.profiles p
WHERE p.id = tl.employee_id
  AND tl.log_date IS DISTINCT FROM (tl.clock_in_at AT TIME ZONE COALESCE(p.timezone, 'UTC'))::date;
