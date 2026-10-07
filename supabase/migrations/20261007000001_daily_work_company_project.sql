-- Link daily work entries to company and project for reporting.

ALTER TABLE public.daily_work_entries
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS daily_work_company_date_idx
  ON public.daily_work_entries (organization_id, company_id, work_date DESC)
  WHERE company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS daily_work_project_date_idx
  ON public.daily_work_entries (organization_id, project_id, work_date DESC)
  WHERE project_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
