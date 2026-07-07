-- Folders for organizing "My Work" sheets/pages.

CREATE TABLE public.employee_work_sheet_folders (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.employee_work_sheet_folders IS
  'Per-employee folders for organizing My Work sheets/pages.';

CREATE INDEX idx_ewsf_employee_id ON public.employee_work_sheet_folders(employee_id);

CREATE TRIGGER trg_employee_work_sheet_folders_updated_at
  BEFORE UPDATE ON public.employee_work_sheet_folders
  FOR EACH ROW EXECUTE FUNCTION public._trg_set_updated_at();

ALTER TABLE public.employee_work_sheet_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ewsf_owner_all" ON public.employee_work_sheet_folders
  FOR ALL TO authenticated
  USING     (employee_id = auth.uid())
  WITH CHECK(employee_id = auth.uid());

ALTER TABLE public.employee_work_sheets
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.employee_work_sheet_folders(id) ON DELETE SET NULL;

CREATE INDEX idx_ews_folder_id ON public.employee_work_sheets(folder_id);

NOTIFY pgrst, 'reload schema';
