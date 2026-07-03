-- Announcements: admin/manager can draft and send team announcements
-- (in-app feed + optional BCC email). Recipients stored explicitly.

CREATE TABLE public.announcements (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           text        NOT NULL,
  body            text        NOT NULL,
  status          text        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'published')),
  recipient_ids   uuid[]      NOT NULL DEFAULT '{}',
  send_email      boolean     NOT NULL DEFAULT true,
  email_sent_at   timestamptz,
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.announcements IS
  'Org announcements — draftable by admin/manager, visible to selected recipients.';

CREATE INDEX idx_ann_created_by   ON public.announcements(created_by);
CREATE INDEX idx_ann_status       ON public.announcements(status);
CREATE INDEX idx_ann_published_at ON public.announcements(published_at DESC NULLS LAST);

CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public._trg_set_updated_at();

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "ann_admin_all" ON public.announcements
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

-- Manager: create/update own drafts; read own + received published
CREATE POLICY "ann_manager_insert" ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK(get_my_role() = 'manager' AND created_by = auth.uid());

CREATE POLICY "ann_manager_update" ON public.announcements
  FOR UPDATE TO authenticated
  USING     (get_my_role() = 'manager' AND created_by = auth.uid())
  WITH CHECK(get_my_role() = 'manager' AND created_by = auth.uid());

CREATE POLICY "ann_manager_delete" ON public.announcements
  FOR DELETE TO authenticated
  USING (
    get_my_role() = 'manager'
    AND created_by = auth.uid()
    AND status = 'draft'
  );

CREATE POLICY "ann_manager_select" ON public.announcements
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'manager'
    AND (
      created_by = auth.uid()
      OR (status = 'published' AND auth.uid() = ANY(recipient_ids))
    )
  );

-- Director / employee: read published announcements sent to them
CREATE POLICY "ann_recipient_select" ON public.announcements
  FOR SELECT TO authenticated
  USING (
    get_my_role() IN ('director', 'employee')
    AND status = 'published'
    AND auth.uid() = ANY(recipient_ids)
  );
