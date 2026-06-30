-- =============================================================================
-- Auto-create a profile row whenever an auth user is inserted.
-- Covers users created via Supabase dashboard, magic link, OAuth, etc.
-- The /api/admin/users route does a subsequent upsert with full data.
-- =============================================================================

CREATE OR REPLACE FUNCTION public._trg_create_profile_on_signup()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.user_role,
      'employee'
    ),
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_create_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public._trg_create_profile_on_signup();

-- Backfill: create profiles for any existing auth users that have no profile row
INSERT INTO public.profiles (id, email, full_name, role, status)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  COALESCE((u.raw_user_meta_data->>'role')::public.user_role, 'employee'),
  'active'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;
