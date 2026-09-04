-- =============================================================================
-- WSSO SaaS 12 — Personal sticky notes
--
-- Each signed-in person keeps their own notes. A note remembers which dashboard
-- tab it was created on. Floating notes show on that tab; the Sticky Notes page
-- lists every note.
--
-- Safe to re-run. Apply in Supabase SQL editor after saas/11.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sticky_notes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  page_path        text NOT NULL,
  page_label       text NOT NULL,
  title            text NOT NULL DEFAULT '',
  body             text NOT NULL DEFAULT '',
  color            text NOT NULL DEFAULT 'yellow',
  pos_x            integer NOT NULL DEFAULT 64,
  pos_y            integer NOT NULL DEFAULT 72,
  z_index          integer NOT NULL DEFAULT 1,
  minimized        boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sticky_notes_color_chk CHECK (color IN ('yellow', 'pink', 'blue', 'green', 'orange'))
);

CREATE INDEX IF NOT EXISTS sticky_notes_profile_page_idx
  ON public.sticky_notes (profile_id, page_path);

CREATE INDEX IF NOT EXISTS sticky_notes_org_idx
  ON public.sticky_notes (organization_id);

DROP TRIGGER IF EXISTS trg_sticky_notes_updated_at ON public.sticky_notes;
CREATE TRIGGER trg_sticky_notes_updated_at
  BEFORE UPDATE ON public.sticky_notes
  FOR EACH ROW EXECUTE FUNCTION public._trg_set_updated_at();

ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sticky_notes_own_all" ON public.sticky_notes;
CREATE POLICY "sticky_notes_own_all" ON public.sticky_notes
  FOR ALL TO authenticated
  USING     (profile_id = auth.uid() AND public.same_org(organization_id))
  WITH CHECK(profile_id = auth.uid() AND public.same_org(organization_id));

NOTIFY pgrst, 'reload schema';
