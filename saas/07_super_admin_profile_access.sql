-- =============================================================================
-- WSSO SaaS 07 — Super Admin can read their own profile (null workspace)
--
-- After 04, Super Admin has organization_id = NULL. The tenant RLS policy
-- on profiles can hide that row, so the app still shows the employee dashboard.
-- Run this once in the Supabase SQL Editor, then sign out and sign in again.
-- =============================================================================

DROP POLICY IF EXISTS "profiles_tenant_isolation" ON public.profiles;
CREATE POLICY "profiles_tenant_isolation" ON public.profiles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING     (id = auth.uid() OR public.same_org(organization_id))
  WITH CHECK(id = auth.uid() OR public.same_org(organization_id));

DROP POLICY IF EXISTS "profiles_super_admin_all" ON public.profiles;
CREATE POLICY "profiles_super_admin_all" ON public.profiles
  FOR ALL TO authenticated
  USING     (public.is_super_admin())
  WITH CHECK(public.is_super_admin());

DROP POLICY IF EXISTS "profiles_super_admin_select" ON public.profiles;
CREATE POLICY "profiles_super_admin_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_super_admin());
