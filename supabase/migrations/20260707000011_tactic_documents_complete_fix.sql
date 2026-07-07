-- =============================================================================
-- COMPLETE FIX for TACTIC document access (run this once in Supabase SQL Editor)
-- - Creates shares table if missing
-- - Fixes RLS infinite recursion (dashboard / list / create 500 errors)
-- - Private by default: owner + direct manager + admin + explicit shares
-- Safe to re-run (idempotent).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tactic_document_shares (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tactic_document_id uuid        NOT NULL REFERENCES public.tactic_documents(id) ON DELETE CASCADE,
  shared_with        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shared_by          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tactic_document_id, shared_with)
);

CREATE INDEX IF NOT EXISTS idx_tdshare_document_id ON public.tactic_document_shares(tactic_document_id);
CREATE INDEX IF NOT EXISTS idx_tdshare_shared_with ON public.tactic_document_shares(shared_with);

ALTER TABLE public.tactic_document_shares ENABLE ROW LEVEL SECURITY;

-- Security-definer helpers (break RLS recursion)
CREATE OR REPLACE FUNCTION public.user_owns_tactic_document(doc_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tactic_documents t
    WHERE t.id = doc_id AND t.created_by = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.tactic_document_shared_with_me(doc_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tactic_document_shares s
    WHERE s.tactic_document_id = doc_id AND s.shared_with = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_direct_report(employee_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = employee_id AND p.manager_id = auth.uid()
  );
$$;

-- Shares table policies
DROP POLICY IF EXISTS "tdshare_admin_all" ON public.tactic_document_shares;
CREATE POLICY "tdshare_admin_all" ON public.tactic_document_shares
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

DROP POLICY IF EXISTS "tdshare_owner_all" ON public.tactic_document_shares;
CREATE POLICY "tdshare_owner_all" ON public.tactic_document_shares
  FOR ALL TO authenticated
  USING     (public.user_owns_tactic_document(tactic_document_id))
  WITH CHECK (
    shared_by = auth.uid()
    AND public.user_owns_tactic_document(tactic_document_id)
  );

DROP POLICY IF EXISTS "tdshare_recipient_select" ON public.tactic_document_shares;
CREATE POLICY "tdshare_recipient_select" ON public.tactic_document_shares
  FOR SELECT TO authenticated
  USING (shared_with = auth.uid());

-- Tactic documents
DROP POLICY IF EXISTS "tdoc_manager_select" ON public.tactic_documents;
CREATE POLICY "tdoc_manager_select" ON public.tactic_documents
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'manager'
    AND (
      created_by = auth.uid()
      OR public.is_direct_report(created_by)
      OR public.tactic_document_shared_with_me(id)
    )
  );

DROP POLICY IF EXISTS "tdoc_employee_shared" ON public.tactic_documents;
CREATE POLICY "tdoc_employee_shared" ON public.tactic_documents
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'employee'
    AND public.tactic_document_shared_with_me(id)
  );

-- Tasks
DROP POLICY IF EXISTS "ttask_manager_select" ON public.tactic_tasks;
CREATE POLICY "ttask_manager_select" ON public.tactic_tasks
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'manager'
    AND tactic_document_id IN (
      SELECT td.id FROM public.tactic_documents td
      WHERE td.created_by = auth.uid()
         OR public.is_direct_report(td.created_by)
         OR public.tactic_document_shared_with_me(td.id)
    )
  );

DROP POLICY IF EXISTS "ttask_employee_shared" ON public.tactic_tasks;
CREATE POLICY "ttask_employee_shared" ON public.tactic_tasks
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'employee'
    AND public.tactic_document_shared_with_me(tactic_document_id)
  );

-- Next steps
DROP POLICY IF EXISTS "tns_manager_select" ON public.tactic_next_steps;
CREATE POLICY "tns_manager_select" ON public.tactic_next_steps
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'manager'
    AND tactic_document_id IN (
      SELECT td.id FROM public.tactic_documents td
      WHERE td.created_by = auth.uid()
         OR public.is_direct_report(td.created_by)
         OR public.tactic_document_shared_with_me(td.id)
    )
  );

DROP POLICY IF EXISTS "tns_employee_shared" ON public.tactic_next_steps;
CREATE POLICY "tns_employee_shared" ON public.tactic_next_steps
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'employee'
    AND public.tactic_document_shared_with_me(tactic_document_id)
  );
