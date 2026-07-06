-- Share My Work sheets with managers/admins; collaborators can edit.

CREATE TABLE public.employee_work_sheet_shares (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id    uuid        NOT NULL REFERENCES public.employee_work_sheets(id) ON DELETE CASCADE,
  shared_with uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  can_edit    boolean     NOT NULL DEFAULT false,
  created_by  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sheet_id, shared_with)
);

COMMENT ON TABLE public.employee_work_sheet_shares IS
  'Per-user access to another employee''s work sheet (view or collaborate/edit).';

CREATE INDEX idx_ewss_sheet_id     ON public.employee_work_sheet_shares(sheet_id);
CREATE INDEX idx_ewss_shared_with  ON public.employee_work_sheet_shares(shared_with);

ALTER TABLE public.employee_work_sheet_shares ENABLE ROW LEVEL SECURITY;

-- Sheet owner manages all shares on their sheets
CREATE POLICY "ewss_owner_manage" ON public.employee_work_sheet_shares
  FOR ALL TO authenticated
  USING (
    sheet_id IN (
      SELECT id FROM public.employee_work_sheets WHERE employee_id = auth.uid()
    )
  )
  WITH CHECK (
    sheet_id IN (
      SELECT id FROM public.employee_work_sheets WHERE employee_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Recipients can see shares granted to them
CREATE POLICY "ewss_recipient_select" ON public.employee_work_sheet_shares
  FOR SELECT TO authenticated
  USING (shared_with = auth.uid());

-- Shared users can read sheets shared with them
CREATE POLICY "ews_shared_select" ON public.employee_work_sheets
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT sheet_id FROM public.employee_work_sheet_shares
      WHERE shared_with = auth.uid()
    )
  );

-- Collaborators (can_edit) may update shared sheets
CREATE POLICY "ews_collaborator_update" ON public.employee_work_sheets
  FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT sheet_id FROM public.employee_work_sheet_shares
      WHERE shared_with = auth.uid() AND can_edit = true
    )
  )
  WITH CHECK (
    id IN (
      SELECT sheet_id FROM public.employee_work_sheet_shares
      WHERE shared_with = auth.uid() AND can_edit = true
    )
  );
