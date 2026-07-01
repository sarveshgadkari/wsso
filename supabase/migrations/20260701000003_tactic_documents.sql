-- =============================================================================
-- WSSO — Tactic Documents, Tasks & Next Steps
-- Migration : 20260701000003_tactic_documents.sql
--
-- Adds three tables that store structured meeting output for a tactic:
--   tactic_documents  — the document itself (auto-code TDOC001…)
--   tactic_tasks      — numbered task items inside the document
--   tactic_next_steps — action / next-step items inside the document
-- =============================================================================


-- ============================================================
-- 1. AUTO-CODE SEQUENCE
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS public.seq_tdoc_code START 1;   -- TDOC001…


-- ============================================================
-- 2. TABLES
-- ============================================================

-- ------------------------------------------------------------
-- 2a. tactic_documents
-- ------------------------------------------------------------
CREATE TABLE public.tactic_documents (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text        UNIQUE NOT NULL,                          -- auto: TDOC001…
  tactic_id    uuid        NOT NULL REFERENCES public.tactics(id) ON DELETE CASCADE,
  title        text        NOT NULL,
  content      text,                                                 -- rich body / meeting notes
  meeting_date date,
  created_by   uuid        NOT NULL REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.tactic_documents      IS 'Meeting output documents linked to a work order (tactic).';
COMMENT ON COLUMN public.tactic_documents.code IS 'Auto-generated: TDOC001, TDOC002 …';

-- ------------------------------------------------------------
-- 2b. tactic_tasks
--     Line-item tasks within a tactic document.
-- ------------------------------------------------------------
CREATE TABLE public.tactic_tasks (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tactic_document_id uuid        NOT NULL REFERENCES public.tactic_documents(id) ON DELETE CASCADE,
  order_no           integer     NOT NULL DEFAULT 1,
  description        text        NOT NULL,
  assigned_to        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  status             text        NOT NULL DEFAULT 'open'
                                   CHECK (status IN ('open', 'done')),
  due_date           date,
  created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.tactic_tasks          IS 'Task line-items inside a tactic document.';
COMMENT ON COLUMN public.tactic_tasks.order_no IS 'Display order within the document.';

-- ------------------------------------------------------------
-- 2c. tactic_next_steps
--     Action / next-step items within a tactic document.
-- ------------------------------------------------------------
CREATE TABLE public.tactic_next_steps (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tactic_document_id uuid        NOT NULL REFERENCES public.tactic_documents(id) ON DELETE CASCADE,
  order_no           integer     NOT NULL DEFAULT 1,
  description        text        NOT NULL,
  owner              uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date           date,
  completed          boolean     NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.tactic_next_steps          IS 'Next-step action items inside a tactic document.';
COMMENT ON COLUMN public.tactic_next_steps.order_no IS 'Display order within the document.';


-- ============================================================
-- 3. TRIGGERS
-- ============================================================

-- ---- 3a. Auto-code for tactic_documents ----------------------

CREATE OR REPLACE FUNCTION public._trg_set_tdoc_code()
  RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  IF NEW.code IS NULL OR trim(NEW.code) = '' THEN
    NEW.code := public.fmt_code('TDOC', nextval('public.seq_tdoc_code'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tactic_documents_code
  BEFORE INSERT ON public.tactic_documents
  FOR EACH ROW EXECUTE FUNCTION public._trg_set_tdoc_code();

-- ---- 3b. updated_at for tactic_documents ----------------------

CREATE TRIGGER trg_tactic_documents_updated_at
  BEFORE UPDATE ON public.tactic_documents
  FOR EACH ROW EXECUTE FUNCTION public._trg_set_updated_at();


-- ============================================================
-- 4. INDEXES
-- ============================================================

CREATE INDEX idx_tdoc_tactic_id    ON public.tactic_documents(tactic_id);
CREATE INDEX idx_tdoc_created_by   ON public.tactic_documents(created_by);

CREATE INDEX idx_ttask_document_id ON public.tactic_tasks(tactic_document_id);
CREATE INDEX idx_ttask_assigned_to ON public.tactic_tasks(assigned_to);

CREATE INDEX idx_tns_document_id   ON public.tactic_next_steps(tactic_document_id);
CREATE INDEX idx_tns_owner         ON public.tactic_next_steps(owner);


-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.tactic_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tactic_tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tactic_next_steps ENABLE ROW LEVEL SECURITY;


-- ── 5a. TACTIC_DOCUMENTS ─────────────────────────────────────

CREATE POLICY "tdoc_admin_all" ON public.tactic_documents
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

CREATE POLICY "tdoc_director_select" ON public.tactic_documents
  FOR SELECT TO authenticated
  USING (get_my_role() = 'director');

-- Manager: full access for documents on their team's tactics
CREATE POLICY "tdoc_manager_all" ON public.tactic_documents
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'manager'
    AND tactic_id IN (
      SELECT id FROM public.tactics
      WHERE  created_by = auth.uid()
         OR  assigned_to IN (
               SELECT id FROM public.profiles WHERE team_id = get_my_team_id()
             )
    )
  )
  WITH CHECK (
    get_my_role() = 'manager'
    AND tactic_id IN (
      SELECT id FROM public.tactics
      WHERE  created_by = auth.uid()
         OR  assigned_to IN (
               SELECT id FROM public.profiles WHERE team_id = get_my_team_id()
             )
    )
  );

-- Employee: documents on tactics assigned to them
CREATE POLICY "tdoc_employee_own" ON public.tactic_documents
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'employee'
    AND tactic_id IN (
      SELECT id FROM public.tactics WHERE assigned_to = auth.uid()
    )
  )
  WITH CHECK (
    get_my_role() = 'employee'
    AND tactic_id IN (
      SELECT id FROM public.tactics WHERE assigned_to = auth.uid()
    )
  );


-- ── 5b. TACTIC_TASKS ─────────────────────────────────────────

CREATE POLICY "ttask_admin_all" ON public.tactic_tasks
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

CREATE POLICY "ttask_director_select" ON public.tactic_tasks
  FOR SELECT TO authenticated
  USING (get_my_role() = 'director');

CREATE POLICY "ttask_manager_all" ON public.tactic_tasks
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'manager'
    AND tactic_document_id IN (
      SELECT id FROM public.tactic_documents
      WHERE  tactic_id IN (
               SELECT id FROM public.tactics
               WHERE  created_by = auth.uid()
                  OR  assigned_to IN (
                        SELECT id FROM public.profiles WHERE team_id = get_my_team_id()
                      )
             )
    )
  )
  WITH CHECK (
    get_my_role() = 'manager'
    AND tactic_document_id IN (
      SELECT id FROM public.tactic_documents
      WHERE  tactic_id IN (
               SELECT id FROM public.tactics
               WHERE  created_by = auth.uid()
                  OR  assigned_to IN (
                        SELECT id FROM public.profiles WHERE team_id = get_my_team_id()
                      )
             )
    )
  );

CREATE POLICY "ttask_employee_own" ON public.tactic_tasks
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'employee'
    AND tactic_document_id IN (
      SELECT id FROM public.tactic_documents
      WHERE  tactic_id IN (
               SELECT id FROM public.tactics WHERE assigned_to = auth.uid()
             )
    )
  )
  WITH CHECK (
    get_my_role() = 'employee'
    AND tactic_document_id IN (
      SELECT id FROM public.tactic_documents
      WHERE  tactic_id IN (
               SELECT id FROM public.tactics WHERE assigned_to = auth.uid()
             )
    )
  );


-- ── 5c. TACTIC_NEXT_STEPS ────────────────────────────────────

CREATE POLICY "tns_admin_all" ON public.tactic_next_steps
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

CREATE POLICY "tns_director_select" ON public.tactic_next_steps
  FOR SELECT TO authenticated
  USING (get_my_role() = 'director');

CREATE POLICY "tns_manager_all" ON public.tactic_next_steps
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'manager'
    AND tactic_document_id IN (
      SELECT id FROM public.tactic_documents
      WHERE  tactic_id IN (
               SELECT id FROM public.tactics
               WHERE  created_by = auth.uid()
                  OR  assigned_to IN (
                        SELECT id FROM public.profiles WHERE team_id = get_my_team_id()
                      )
             )
    )
  )
  WITH CHECK (
    get_my_role() = 'manager'
    AND tactic_document_id IN (
      SELECT id FROM public.tactic_documents
      WHERE  tactic_id IN (
               SELECT id FROM public.tactics
               WHERE  created_by = auth.uid()
                  OR  assigned_to IN (
                        SELECT id FROM public.profiles WHERE team_id = get_my_team_id()
                      )
             )
    )
  );

CREATE POLICY "tns_employee_own" ON public.tactic_next_steps
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'employee'
    AND tactic_document_id IN (
      SELECT id FROM public.tactic_documents
      WHERE  tactic_id IN (
               SELECT id FROM public.tactics WHERE assigned_to = auth.uid()
             )
    )
  )
  WITH CHECK (
    get_my_role() = 'employee'
    AND tactic_document_id IN (
      SELECT id FROM public.tactic_documents
      WHERE  tactic_id IN (
               SELECT id FROM public.tactics WHERE assigned_to = auth.uid()
             )
    )
  );
