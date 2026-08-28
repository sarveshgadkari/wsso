-- =============================================================================
-- WSSO 08 — Cap a work day at 24 hours; auto clock-out at local midnight
-- Run in Supabase SQL Editor after 07.
-- =============================================================================

CREATE OR REPLACE FUNCTION public._trg_calc_duration()
  RETURNS trigger LANGUAGE plpgsql AS
$$
DECLARE
  emp_tz text;
  local_midnight timestamptz;
  max_out timestamptz;
BEGIN
  SELECT COALESCE(timezone, 'Asia/Kolkata') INTO emp_tz
  FROM public.profiles
  WHERE id = NEW.employee_id;

  NEW.log_date := (NEW.clock_in_at AT TIME ZONE emp_tz)::date;

  -- 00:00 next local calendar day in the employee's country timezone
  local_midnight := ((NEW.log_date + 1)::timestamp AT TIME ZONE emp_tz);
  max_out := NEW.clock_in_at + interval '24 hours';

  IF NEW.clock_out_at IS NOT NULL THEN
    IF NEW.clock_out_at > local_midnight THEN
      NEW.clock_out_at := local_midnight;
    END IF;
    IF NEW.clock_out_at > max_out THEN
      NEW.clock_out_at := max_out;
    END IF;
    IF NEW.clock_out_at <= NEW.clock_in_at THEN
      NEW.clock_out_at := NEW.clock_in_at + interval '1 second';
    END IF;
    NEW.duration_minutes := LEAST(
      24 * 60,
      GREATEST(0, EXTRACT(EPOCH FROM (NEW.clock_out_at - NEW.clock_in_at))::integer / 60)
    );
  ELSE
    NEW.duration_minutes := NULL;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.time_logs
SET duration_minutes = LEAST(duration_minutes, 24 * 60)
WHERE duration_minutes IS NOT NULL
  AND duration_minutes > 24 * 60;
