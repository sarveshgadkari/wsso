-- TACTIC documents: private by default (owner + direct manager + admin).
-- Optional explicit shares for additional viewers.

CREATE TABLE public.tactic_document_shares (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tactic_document_id uuid        NOT NULL REFERENCES public.tactic_documents(id) ON DELETE CASCADE,
  shared_with        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shared_by          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tactic_document_id, shared_with)
);

CREATE INDEX idx_tdshare_document_id ON public.tactic_document_shares(tactic_document_id);
CREATE INDEX idx_tdshare_shared_with ON public.tactic_document_shares(shared_with);

ALTER TABLE public.tactic_document_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tdshare_admin_all" ON public.tactic_document_shares
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

CREATE POLICY "tdshare_owner_all" ON public.tactic_document_shares
  FOR ALL TO authenticated
  USING (
    tactic_document_id IN (
      SELECT id FROM public.tactic_documents WHERE created_by = auth.uid()
    )
  )
  WITH CHECK (
    shared_by = auth.uid()
    AND tactic_document_id IN (
      SELECT id FROM public.tactic_documents WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "tdshare_recipient_select" ON public.tactic_document_shares
  FOR SELECT TO authenticated
  USING (shared_with = auth.uid());

-- ── TACTIC_DOCUMENTS: restrict manager visibility to direct reports + shares ──

DROP POLICY IF EXISTS "tdoc_manager_select" ON public.tactic_documents;

CREATE POLICY "tdoc_manager_select" ON public.tactic_documents
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'manager'
    AND (
      created_by = auth.uid()
      OR created_by IN (
        SELECT p.id FROM public.profiles p WHERE p.manager_id = auth.uid()
      )
      OR id IN (
        SELECT s.tactic_document_id
        FROM   public.tactic_document_shares s
        WHERE  s.shared_with = auth.uid()
      )
    )
  );

CREATE POLICY "tdoc_employee_shared" ON public.tactic_documents
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'employee'
    AND id IN (
      SELECT s.tactic_document_id
      FROM   public.tactic_document_shares s
      WHERE  s.shared_with = auth.uid()
    )
  );

-- ── TACTIC_TASKS ─────────────────────────────────────────────

DROP POLICY IF EXISTS "ttask_manager_select" ON public.tactic_tasks;

CREATE POLICY "ttask_manager_select" ON public.tactic_tasks
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'manager'
    AND tactic_document_id IN (
      SELECT td.id
      FROM   public.tactic_documents td
      WHERE  td.created_by = auth.uid()
         OR  td.created_by IN (SELECT p.id FROM public.profiles p WHERE p.manager_id = auth.uid())
         OR  td.id IN (
               SELECT s.tactic_document_id
               FROM   public.tactic_document_shares s
               WHERE  s.shared_with = auth.uid()
             )
    )
  );

CREATE POLICY "ttask_employee_shared" ON public.tactic_tasks
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'employee'
    AND tactic_document_id IN (
      SELECT s.tactic_document_id
      FROM   public.tactic_document_shares s
      WHERE  s.shared_with = auth.uid()
    )
  );

-- ── TACTIC_NEXT_STEPS ──────────────────────────────────────────

DROP POLICY IF EXISTS "tns_manager_select" ON public.tactic_next_steps;

CREATE POLICY "tns_manager_select" ON public.tactic_next_steps
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'manager'
    AND tactic_document_id IN (
      SELECT td.id
      FROM   public.tactic_documents td
      WHERE  td.created_by = auth.uid()
         OR  td.created_by IN (SELECT p.id FROM public.profiles p WHERE p.manager_id = auth.uid())
         OR  td.id IN (
               SELECT s.tactic_document_id
               FROM   public.tactic_document_shares s
               WHERE  s.shared_with = auth.uid()
             )
    )
  );

CREATE POLICY "tns_employee_shared" ON public.tactic_next_steps
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'employee'
    AND tactic_document_id IN (
      SELECT s.tactic_document_id
      FROM   public.tactic_document_shares s
      WHERE  s.shared_with = auth.uid()
    )
  );
