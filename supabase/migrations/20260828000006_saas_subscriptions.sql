-- =============================================================================
-- WSSO SaaS 06 — Dynamic subscription plans + payments
-- Run AFTER 01–03. Super Admin sets prices; workspace admin pays for the company.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  slug                 text NOT NULL,
  description          text,
  monthly_price_cents  integer NOT NULL DEFAULT 0 CHECK (monthly_price_cents >= 0),
  yearly_price_cents   integer NOT NULL DEFAULT 0 CHECK (yearly_price_cents >= 0),
  seat_limit           integer NOT NULL DEFAULT 10 CHECK (seat_limit > 0),
  trial_days           integer NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  is_active            boolean NOT NULL DEFAULT true,
  sort_order           integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_plans_slug_chk CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_slug_uidx
  ON public.subscription_plans (slug);

DROP TRIGGER IF EXISTS trg_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER trg_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public._trg_set_updated_at();

COMMENT ON TABLE public.subscription_plans IS
  'Prices Super Admin can change anytime. Workspace admin subscribes the whole company.';

INSERT INTO public.subscription_plans
  (name, slug, description, monthly_price_cents, yearly_price_cents, seat_limit, trial_days, sort_order)
VALUES
  ('Trial',     'trial',     '14-day evaluation',                         0,       0,   10, 14, 0),
  ('Starter',   'starter',   'Small teams',                            9900,   99000,   10, 14, 1),
  ('Growth',    'growth',    'Typical SMB',                           29900,  299000,   50, 14, 2),
  ('Business',  'business',  'Larger orgs',                           69900,  699000,  150,  0, 3),
  ('Enterprise','enterprise','Custom seats — edit price as needed', 150000, 1500000,  500,  0, 4)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS billing_interval text CHECK (billing_interval IN ('month', 'year')),
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

CREATE INDEX IF NOT EXISTS idx_organizations_plan_id ON public.organizations (plan_id);

-- Attach existing workspaces to the matching seeded plan (or Business)
UPDATE public.organizations o
SET plan_id = p.id
FROM public.subscription_plans p
WHERE o.plan_id IS NULL
  AND p.slug = o.plan::text;

UPDATE public.organizations o
SET plan_id = (SELECT id FROM public.subscription_plans WHERE slug = 'business' LIMIT 1)
WHERE o.plan_id IS NULL;

CREATE TABLE IF NOT EXISTS public.organization_payments (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id                     uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  amount_cents                integer NOT NULL CHECK (amount_cents >= 0),
  currency                    text NOT NULL DEFAULT 'usd',
  billing_interval            text NOT NULL CHECK (billing_interval IN ('month', 'year')),
  status                      text NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  provider                    text NOT NULL DEFAULT 'stripe'
                                CHECK (provider IN ('stripe', 'manual')),
  stripe_checkout_session_id  text,
  stripe_payment_intent_id    text,
  notes                       text,
  created_by                  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  paid_at                     timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_payments_org
  ON public.organization_payments (organization_id, created_at DESC);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans_public_select" ON public.subscription_plans;
CREATE POLICY "plans_public_select" ON public.subscription_plans
  FOR SELECT TO authenticated
  USING (is_active OR public.is_super_admin());

DROP POLICY IF EXISTS "plans_super_admin_all" ON public.subscription_plans;
CREATE POLICY "plans_super_admin_all" ON public.subscription_plans
  FOR ALL TO authenticated
  USING     (public.is_super_admin())
  WITH CHECK(public.is_super_admin());

DROP POLICY IF EXISTS "payments_super_admin_all" ON public.organization_payments;
CREATE POLICY "payments_super_admin_all" ON public.organization_payments
  FOR ALL TO authenticated
  USING     (public.is_super_admin())
  WITH CHECK(public.is_super_admin());

DROP POLICY IF EXISTS "payments_org_admin_select" ON public.organization_payments;
CREATE POLICY "payments_org_admin_select" ON public.organization_payments
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'admin'
    AND public.same_org(organization_id)
  );
