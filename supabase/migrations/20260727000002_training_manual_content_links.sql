-- Allow manual text training content + pasted resource links on modules

ALTER TABLE public.training_modules
  ADD COLUMN IF NOT EXISTS body_content text,
  ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.training_modules.body_content IS
  'Optional manual training text written by admin (in addition to or instead of a file).';
COMMENT ON COLUMN public.training_modules.links IS
  'Optional resource links: [{ "title": "…", "url": "https://…" }, …]';
