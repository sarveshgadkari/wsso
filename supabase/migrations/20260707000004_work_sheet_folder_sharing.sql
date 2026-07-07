-- Share whole "My Work" folders with managers/admins/employees; collaborators can edit
-- every sheet inside. Uses SECURITY DEFINER helper functions (see
-- 20260707000001_fix_work_sheet_sharing_recursion.sql) to avoid recursive-RLS deadlocks
-- between employee_work_sheet_folders, employee_work_sheet_folder_shares, and
-- employee_work_sheets, which cross-reference each other.

CREATE TABLE public.employee_work_sheet_folder_shares (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id   uuid        NOT NULL REFERENCES public.employee_work_sheet_folders(id) ON DELETE CASCADE,
  shared_with uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  can_edit    boolean     NOT NULL DEFAULT false,
  created_by  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (folder_id, shared_with)
);

COMMENT ON TABLE public.employee_work_sheet_folder_shares IS
  'Per-user access to another employee''s work-sheet folder (view or collaborate/edit everything inside).';

CREATE INDEX idx_ewsfs_folder_id    ON public.employee_work_sheet_folder_shares(folder_id);
CREATE INDEX idx_ewsfs_shared_with  ON public.employee_work_sheet_folder_shares(shared_with);

ALTER TABLE public.employee_work_sheet_folder_shares ENABLE ROW LEVEL SECURITY;

-- Helper functions (SECURITY DEFINER bypasses RLS so cross-table checks don't recurse)

CREATE OR REPLACE FUNCTION public._is_folder_owner(p_folder_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employee_work_sheet_folders
    WHERE id = p_folder_id AND employee_id = p_uid
  );
$$;

CREATE OR REPLACE FUNCTION public._folder_shared_with(p_folder_id uuid, p_uid uuid, p_require_edit boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p_folder_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.employee_work_sheet_folder_shares
    WHERE folder_id = p_folder_id AND shared_with = p_uid
      AND (NOT p_require_edit OR can_edit = true)
  );
$$;

GRANT EXECUTE ON FUNCTION public._is_folder_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._folder_shared_with(uuid, uuid, boolean) TO authenticated;

-- Folder owner manages all shares on their folders
CREATE POLICY "ewsfs_owner_manage" ON public.employee_work_sheet_folder_shares
  FOR ALL TO authenticated
  USING (public._is_folder_owner(folder_id, auth.uid()))
  WITH CHECK (
    public._is_folder_owner(folder_id, auth.uid())
    AND created_by = auth.uid()
  );

-- Recipients can see shares granted to them
CREATE POLICY "ewsfs_recipient_select" ON public.employee_work_sheet_folder_shares
  FOR SELECT TO authenticated
  USING (shared_with = auth.uid());

-- Recipients can see the folder itself (name, etc.) once shared with them
CREATE POLICY "ewsf_shared_select" ON public.employee_work_sheet_folders
  FOR SELECT TO authenticated
  USING (public._folder_shared_with(id, auth.uid()));

-- Recipients can see every sheet inside a folder shared with them
CREATE POLICY "ews_folder_shared_select" ON public.employee_work_sheets
  FOR SELECT TO authenticated
  USING (public._folder_shared_with(folder_id, auth.uid()));

-- Collaborators (can_edit) on a shared folder may update any sheet inside it
CREATE POLICY "ews_folder_collaborator_update" ON public.employee_work_sheets
  FOR UPDATE TO authenticated
  USING (public._folder_shared_with(folder_id, auth.uid(), true))
  WITH CHECK (public._folder_shared_with(folder_id, auth.uid(), true));

NOTIFY pgrst, 'reload schema';
