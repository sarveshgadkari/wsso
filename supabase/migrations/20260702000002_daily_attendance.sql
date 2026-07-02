-- =============================================================================
-- One time log per employee per local calendar day (log_date).
-- Track whether clock-in came from app login or manual button.
-- =============================================================================

ALTER TABLE public.time_logs
  ADD COLUMN IF NOT EXISTS clock_in_source text NOT NULL DEFAULT 'manual'
  CHECK (clock_in_source IN ('manual', 'login'));

COMMENT ON COLUMN public.time_logs.clock_in_source IS
  'manual = employee clicked Clock In; login = first sign-in of the local day.';

-- ── Merge duplicate rows (same employee + log_date) before unique index ────────
-- Keeps the earliest clock-in row per day; merges clock-out and status from all.

WITH dup_groups AS (
  SELECT employee_id, log_date
  FROM public.time_logs
  WHERE log_date IS NOT NULL
  GROUP BY employee_id, log_date
  HAVING COUNT(*) > 1
),
ranked AS (
  SELECT
    tl.id,
    tl.employee_id,
    tl.log_date,
    ROW_NUMBER() OVER (
      PARTITION BY tl.employee_id, tl.log_date
      ORDER BY tl.clock_in_at ASC, tl.created_at ASC
    ) AS rn
  FROM public.time_logs tl
  INNER JOIN dup_groups d
    ON d.employee_id = tl.employee_id
   AND d.log_date = tl.log_date
),
keepers AS (
  SELECT id AS keep_id, employee_id, log_date
  FROM ranked
  WHERE rn = 1
),
merged AS (
  SELECT
    k.keep_id,
    MIN(tl.clock_in_at) AS clock_in_at,
    CASE
      WHEN BOOL_OR(tl.clock_out_at IS NULL) THEN NULL
      ELSE MAX(tl.clock_out_at)
    END AS clock_out_at,
    CASE
      WHEN BOOL_OR(tl.closed_reason = 'auto_logout') THEN 'auto_logout'::public.clock_close_reason
      WHEN BOOL_OR(tl.closed_reason = 'admin_correction') THEN 'admin_correction'::public.clock_close_reason
      WHEN BOOL_OR(tl.closed_reason = 'manual') THEN 'manual'::public.clock_close_reason
      ELSE NULL
    END AS closed_reason,
    BOOL_OR(COALESCE(tl.auto_closed, false)) AS auto_closed
  FROM keepers k
  INNER JOIN public.time_logs tl
    ON tl.employee_id = k.employee_id
   AND tl.log_date = k.log_date
  GROUP BY k.keep_id
)
UPDATE public.time_logs tl
SET
  clock_in_at   = m.clock_in_at,
  clock_out_at  = m.clock_out_at,
  closed_reason = m.closed_reason,
  auto_closed   = m.auto_closed
FROM merged m
WHERE tl.id = m.keep_id;

DELETE FROM public.time_logs tl
USING (
  SELECT r.id
  FROM (
    SELECT
      tl2.id,
      ROW_NUMBER() OVER (
        PARTITION BY tl2.employee_id, tl2.log_date
        ORDER BY tl2.clock_in_at ASC, tl2.created_at ASC
      ) AS rn
    FROM public.time_logs tl2
    WHERE tl2.log_date IS NOT NULL
  ) r
  WHERE r.rn > 1
) dup
WHERE tl.id = dup.id;

-- Enforce one session row per employee per log_date (employee timezone via trigger)
CREATE UNIQUE INDEX IF NOT EXISTS time_logs_one_per_employee_day_idx
  ON public.time_logs (employee_id, log_date);
