-- =============================================================================
-- WSSO — Extend TACTIC Documents module to full production schema
-- Migration : 20260701000004_tactic_documents_extend.sql
--
-- Phase 1 created the three tables with a placeholder schema.
-- This migration rewrites them to the full meeting-output document structure.
-- =============================================================================


-- ============================================================
-- 1. EXTEND tactic_documents
-- ============================================================

-- Make tactic_id optional (linking to a specific work order is not always needed)
ALTER TABLE public.tactic_documents
  ALTER COLUMN tactic_id DROP NOT NULL;

-- Drop Phase 1 placeholder columns (never populated in production)
ALTER TABLE public.tactic_documents
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS content;

-- Add all meeting-document fields
ALTER TABLE public.tactic_documents
  ADD COLUMN IF NOT EXISTS date_of_meeting date,
  ADD COLUMN IF NOT EXISTS time_of_meeting  text,
  ADD COLUMN IF NOT EXISTS facilitator      text,
  ADD COLUMN IF NOT EXISTS location         text,
  ADD COLUMN IF NOT EXISTS attendees        text,
  ADD COLUMN IF NOT EXISTS purpose          text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS background_info  text,
  ADD COLUMN IF NOT EXISTS takeaways        text,
  ADD COLUMN IF NOT EXISTS status           text NOT NULL DEFAULT 'draft'
                                              CHECK (status IN (
                                                'draft','submitted','reviewed',
                                                'approved','revision_needed'
                                              )),
  ADD COLUMN IF NOT EXISTS reviewer_id      uuid REFERENCES public.profiles(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_note      text,
  ADD COLUMN IF NOT EXISTS submitted_at     timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS company_id       uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id       uuid REFERENCES public.projects(id)  ON DELETE SET NULL;

-- Remove the DEFAULT '' now that the column exists
ALTER TABLE public.tactic_documents ALTER COLUMN purpose DROP DEFAULT;


-- ============================================================
-- 2. EXTEND tactic_tasks
-- ============================================================

-- Drop the old ('open','done') status check constraint
ALTER TABLE public.tactic_tasks
  DROP CONSTRAINT IF EXISTS tactic_tasks_status_check;

-- Add new columns
ALTER TABLE public.tactic_tasks
  ADD COLUMN IF NOT EXISTS title       text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS owner_name  text,
  ADD COLUMN IF NOT EXISTS target_date date;

-- Update status check to the three-state model
ALTER TABLE public.tactic_tasks
  ADD CONSTRAINT tactic_tasks_status_check
  CHECK (status IN ('pending','in_progress','completed'));

-- Migrate any Phase 1 test data to new status values
UPDATE public.tactic_tasks SET status = 'pending'   WHERE status = 'open';
UPDATE public.tactic_tasks SET status = 'completed' WHERE status = 'done';

ALTER TABLE public.tactic_tasks ALTER COLUMN title DROP DEFAULT;


-- ============================================================
-- 3. EXTEND tactic_next_steps
-- ============================================================

ALTER TABLE public.tactic_next_steps
  ADD COLUMN IF NOT EXISTS owner_name text;


-- ============================================================
-- 4. INDEXES for new FK columns on tactic_documents
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tdoc_company_id  ON public.tactic_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_tdoc_project_id  ON public.tactic_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_tdoc_reviewer_id ON public.tactic_documents(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_tdoc_status      ON public.tactic_documents(status);
CREATE INDEX IF NOT EXISTS idx_tdoc_created_by2 ON public.tactic_documents(created_by);


-- ============================================================
-- 5. REPLACE RLS POLICIES
-- ============================================================

-- Drop all Phase 1 policies
DROP POLICY IF EXISTS "tdoc_admin_all"         ON public.tactic_documents;
DROP POLICY IF EXISTS "tdoc_director_select"   ON public.tactic_documents;
DROP POLICY IF EXISTS "tdoc_manager_all"       ON public.tactic_documents;
DROP POLICY IF EXISTS "tdoc_employee_own"      ON public.tactic_documents;
DROP POLICY IF EXISTS "tdoc_manager_select"    ON public.tactic_documents;
DROP POLICY IF EXISTS "tdoc_manager_write_own" ON public.tactic_documents;

DROP POLICY IF EXISTS "ttask_admin_all"        ON public.tactic_tasks;
DROP POLICY IF EXISTS "ttask_director_select"  ON public.tactic_tasks;
DROP POLICY IF EXISTS "ttask_manager_all"      ON public.tactic_tasks;
DROP POLICY IF EXISTS "ttask_employee_own"     ON public.tactic_tasks;
DROP POLICY IF EXISTS "ttask_manager_select"   ON public.tactic_tasks;
DROP POLICY IF EXISTS "ttask_manager_write_own"ON public.tactic_tasks;

DROP POLICY IF EXISTS "tns_admin_all"          ON public.tactic_next_steps;
DROP POLICY IF EXISTS "tns_director_select"    ON public.tactic_next_steps;
DROP POLICY IF EXISTS "tns_manager_all"        ON public.tactic_next_steps;
DROP POLICY IF EXISTS "tns_employee_own"       ON public.tactic_next_steps;
DROP POLICY IF EXISTS "tns_manager_select"     ON public.tactic_next_steps;
DROP POLICY IF EXISTS "tns_manager_write_own"  ON public.tactic_next_steps;


-- ── 5a. TACTIC_DOCUMENTS ─────────────────────────────────────

CREATE POLICY "tdoc_admin_all" ON public.tactic_documents
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

CREATE POLICY "tdoc_director_select" ON public.tactic_documents
  FOR SELECT TO authenticated
  USING (get_my_role() = 'director');

-- Manager SELECT: all docs created by anyone in their company
CREATE POLICY "tdoc_manager_select" ON public.tactic_documents
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'manager'
    AND created_by IN (
      SELECT ec.employee_id
      FROM   public.employee_companies ec
      WHERE  ec.company_id IN (
               SELECT ec2.company_id
               FROM   public.employee_companies ec2
               WHERE  ec2.employee_id = auth.uid()
             )
    )
  );

-- Manager WRITE: only their own documents
CREATE POLICY "tdoc_manager_write_own" ON public.tactic_documents
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'manager'
    AND created_by = auth.uid()
  )
  WITH CHECK (
    get_my_role() = 'manager'
    AND created_by = auth.uid()
  );

-- Employee: own documents only
CREATE POLICY "tdoc_employee_own" ON public.tactic_documents
  FOR ALL TO authenticated
  USING     (get_my_role() = 'employee' AND created_by = auth.uid())
  WITH CHECK(get_my_role() = 'employee' AND created_by = auth.uid());


-- ── 5b. TACTIC_TASKS ─────────────────────────────────────────

CREATE POLICY "ttask_admin_all" ON public.tactic_tasks
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

CREATE POLICY "ttask_director_select" ON public.tactic_tasks
  FOR SELECT TO authenticated
  USING (get_my_role() = 'director');

CREATE POLICY "ttask_manager_select" ON public.tactic_tasks
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'manager'
    AND tactic_document_id IN (
      SELECT id FROM public.tactic_documents
      WHERE  created_by IN (
               SELECT ec.employee_id
               FROM   public.employee_companies ec
               WHERE  ec.company_id IN (
                        SELECT ec2.company_id
                        FROM   public.employee_companies ec2
                        WHERE  ec2.employee_id = auth.uid()
                      )
             )
    )
  );

CREATE POLICY "ttask_manager_write_own" ON public.tactic_tasks
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'manager'
    AND tactic_document_id IN (
      SELECT id FROM public.tactic_documents WHERE created_by = auth.uid()
    )
  )
  WITH CHECK (
    get_my_role() = 'manager'
    AND tactic_document_id IN (
      SELECT id FROM public.tactic_documents WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "ttask_employee_own" ON public.tactic_tasks
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'employee'
    AND tactic_document_id IN (
      SELECT id FROM public.tactic_documents WHERE created_by = auth.uid()
    )
  )
  WITH CHECK (
    get_my_role() = 'employee'
    AND tactic_document_id IN (
      SELECT id FROM public.tactic_documents WHERE created_by = auth.uid()
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

CREATE POLICY "tns_manager_select" ON public.tactic_next_steps
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'manager'
    AND tactic_document_id IN (
      SELECT id FROM public.tactic_documents
      WHERE  created_by IN (
               SELECT ec.employee_id
               FROM   public.employee_companies ec
               WHERE  ec.company_id IN (
                        SELECT ec2.company_id
                        FROM   public.employee_companies ec2
                        WHERE  ec2.employee_id = auth.uid()
                      )
             )
    )
  );

CREATE POLICY "tns_manager_write_own" ON public.tactic_next_steps
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'manager'
    AND tactic_document_id IN (
      SELECT id FROM public.tactic_documents WHERE created_by = auth.uid()
    )
  )
  WITH CHECK (
    get_my_role() = 'manager'
    AND tactic_document_id IN (
      SELECT id FROM public.tactic_documents WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "tns_employee_own" ON public.tactic_next_steps
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'employee'
    AND tactic_document_id IN (
      SELECT id FROM public.tactic_documents WHERE created_by = auth.uid()
    )
  )
  WITH CHECK (
    get_my_role() = 'employee'
    AND tactic_document_id IN (
      SELECT id FROM public.tactic_documents WHERE created_by = auth.uid()
    )
  );
