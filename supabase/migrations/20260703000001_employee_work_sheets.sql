-- =============================================================================
-- Personal work sheets: per-employee flexible spreadsheets (Excel import + edit)
-- =============================================================================

CREATE TABLE public.employee_work_sheets (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  columns          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  rows             jsonb       NOT NULL DEFAULT '[]'::jsonb,
  source_filename  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.employee_work_sheets IS
  'Personal flexible work trackers per employee (imported Excel or created in-app).';

CREATE INDEX idx_ews_employee_id ON public.employee_work_sheets(employee_id);

CREATE TRIGGER trg_employee_work_sheets_updated_at
  BEFORE UPDATE ON public.employee_work_sheets
  FOR EACH ROW EXECUTE FUNCTION public._trg_set_updated_at();

ALTER TABLE public.employee_work_sheets ENABLE ROW LEVEL SECURITY;

-- Owner only: each user manages their own sheets
CREATE POLICY "ews_owner_all" ON public.employee_work_sheets
  FOR ALL TO authenticated
  USING     (employee_id = auth.uid())
  WITH CHECK(employee_id = auth.uid());
