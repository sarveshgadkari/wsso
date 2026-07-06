-- Fix "infinite recursion detected in policy for relation employee_work_sheets".
--
-- employee_work_sheets policies (ews_shared_select, ews_collaborator_update) queried
-- employee_work_sheet_shares, while employee_work_sheet_shares' policy (ewss_owner_manage)
-- queried employee_work_sheets back. RLS re-evaluates policies on every table touched by a
-- subquery, so these two RLS-enabled tables referencing each other formed a cycle Postgres
-- detects as infinite recursion. SECURITY DEFINER helper functions resolve the cross-table
-- check without re-triggering RLS, breaking the cycle.

CREATE OR REPLACE FUNCTION public._is_work_sheet_owner(p_sheet_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employee_work_sheets
    WHERE id = p_sheet_id AND employee_id = p_uid
  );
$$;

CREATE OR REPLACE FUNCTION public._work_sheet_shared_with(p_sheet_id uuid, p_uid uuid, p_require_edit boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employee_work_sheet_shares
    WHERE sheet_id = p_sheet_id AND shared_with = p_uid
      AND (NOT p_require_edit OR can_edit = true)
  );
$$;

GRANT EXECUTE ON FUNCTION public._is_work_sheet_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._work_sheet_shared_with(uuid, uuid, boolean) TO authenticated;

DROP POLICY IF EXISTS "ewss_owner_manage" ON public.employee_work_sheet_shares;
CREATE POLICY "ewss_owner_manage" ON public.employee_work_sheet_shares
  FOR ALL TO authenticated
  USING (public._is_work_sheet_owner(sheet_id, auth.uid()))
  WITH CHECK (
    public._is_work_sheet_owner(sheet_id, auth.uid())
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "ews_shared_select" ON public.employee_work_sheets;
CREATE POLICY "ews_shared_select" ON public.employee_work_sheets
  FOR SELECT TO authenticated
  USING (public._work_sheet_shared_with(id, auth.uid()));

DROP POLICY IF EXISTS "ews_collaborator_update" ON public.employee_work_sheets;
CREATE POLICY "ews_collaborator_update" ON public.employee_work_sheets
  FOR UPDATE TO authenticated
  USING (public._work_sheet_shared_with(id, auth.uid(), true))
  WITH CHECK (public._work_sheet_shared_with(id, auth.uid(), true));

NOTIFY pgrst, 'reload schema';
