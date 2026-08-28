-- =============================================================================
-- WSSO SaaS 05 — Optional checks after 01–04
-- Run in SQL Editor as a sanity check. No writes.
-- =============================================================================

-- 1. Super Admin exists
SELECT email, role, organization_id
FROM   public.profiles
WHERE  role = 'super_admin';

-- 2. Every tenant user belongs to a workspace
SELECT count(*) AS tenant_users_missing_org
FROM   public.profiles
WHERE  role <> 'super_admin'
  AND  organization_id IS NULL;

-- 3. Seat usage per workspace
SELECT
  o.name,
  o.slug,
  o.plan,
  o.status,
  o.seat_limit,
  public.org_active_seat_count(o.id) AS seats_used
FROM public.organizations o
ORDER BY o.created_at;

-- 4. Helper smoke (run while logged in as a tenant user in the SQL editor
--    this will be NULL because the SQL editor is not a JWT session)
SELECT
  public.get_my_org_id()     AS my_org,
  public.is_super_admin()    AS am_super_admin,
  public.get_my_role()       AS my_role;
