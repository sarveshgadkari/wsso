-- Add Notion-style document pages alongside Excel spreadsheets

ALTER TABLE public.employee_work_sheets
  ADD COLUMN IF NOT EXISTS sheet_type text NOT NULL DEFAULT 'spreadsheet'
  CHECK (sheet_type IN ('spreadsheet', 'document'));

ALTER TABLE public.employee_work_sheets
  ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.employee_work_sheets.sheet_type IS
  'spreadsheet = Excel grid; document = Notion-style block editor.';

COMMENT ON COLUMN public.employee_work_sheets.blocks IS
  'BlockNote JSON blocks for document-type sheets.';
