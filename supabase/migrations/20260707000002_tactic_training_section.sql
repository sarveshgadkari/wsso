-- Add a training section to work orders (tactics): optional instructions text
-- plus an optional link (e.g. to a training doc/video) for the assigned employee.

ALTER TABLE public.tactics
  ADD COLUMN IF NOT EXISTS training_notes text,
  ADD COLUMN IF NOT EXISTS training_link  text;

COMMENT ON COLUMN public.tactics.training_notes IS
  'Optional training/instructions for the assignee, shown below the description.';
COMMENT ON COLUMN public.tactics.training_link IS
  'Optional URL to training material (doc, video, etc.) related to this work order.';

NOTIFY pgrst, 'reload schema';
