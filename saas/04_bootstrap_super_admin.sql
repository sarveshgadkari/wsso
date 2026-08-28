-- =============================================================================
-- WSSO SaaS 04 — Promote YOUR account to Super Admin (platform owner)
--
-- 1. Replace YOUR_EMAIL_HERE with the email you already use to log in.
-- 2. Run this file in the Supabase SQL Editor.
-- 3. Sign out of WSSO and sign in again. You will land on /platform.
--
-- Super Admin has no workspace (organization_id is NULL).
-- All other existing users stay in the "default" workspace.
-- =============================================================================

UPDATE public.profiles
SET
  role             = 'super_admin',
  organization_id  = NULL,
  department       = COALESCE(department, 'Platform')
WHERE lower(email) = lower('YOUR_EMAIL_HERE');

-- Remaining workspace admins in the backfilled tenant (you just left it):
SELECT p.email, p.full_name, p.role
FROM   public.profiles p
JOIN   public.organizations o ON o.id = p.organization_id
WHERE  o.slug = 'default'
  AND  p.role = 'admin';

-- If that list is empty: after you sign in at /platform, open the "default"
-- workspace and invite a workspace admin so the original company can keep using WSSO.

-- Confirm Super Admin (should return 1 row):
SELECT id, email, full_name, role, organization_id, employee_code
FROM   public.profiles
WHERE  role = 'super_admin';
