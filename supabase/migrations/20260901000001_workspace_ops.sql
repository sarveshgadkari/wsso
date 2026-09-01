-- =============================================================================
-- WSSO SaaS 09 — Workspace operations (admin-configurable, per tenant)
-- Run AFTER 08_time_log_day_cap.sql
--
-- Adds:
--   - organizations.settings JSON (feature flags + time / CRM / work-order rules)
--   - Locations, holidays, generic catalogs (leave types, win/lost, skills, …)
--   - Custom fields, checklist templates, follow-ups, compliance, recurring jobs
--   - Extra columns on profiles / leads / leave / tactics / time / training
--   - Tenant RLS + organization_id stamp on every new table
--   - Default catalogs seeded for every existing (and future) workspace
-- =============================================================================

-- ============================================================
-- A. Organization settings + extra columns
-- ============================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hourly_rate_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS location_id uuid,
  ADD COLUMN IF NOT EXISTS backup_approver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS converted_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS outcome_reason text,
  ADD COLUMN IF NOT EXISTS next_follow_up_at date,
  ADD COLUMN IF NOT EXISTS estimated_value_cents integer NOT NULL DEFAULT 0;

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS leave_type_id uuid;

ALTER TABLE public.tactics
  ADD COLUMN IF NOT EXISTS checklist_template_id uuid,
  ADD COLUMN IF NOT EXISTS work_order_type_id uuid,
  ADD COLUMN IF NOT EXISTS sla_hours integer,
  ADD COLUMN IF NOT EXISTS billable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS location_id uuid;

ALTER TABLE public.time_logs
  ADD COLUMN IF NOT EXISTS break_minutes integer NOT NULL DEFAULT 0;

ALTER TABLE public.training_modules
  ADD COLUMN IF NOT EXISTS certificate_valid_days integer;


-- ============================================================
-- B. New tables
-- ============================================================

CREATE TABLE IF NOT EXISTS public.org_locations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  address         text,
  timezone        text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_holidays (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  holiday_on      date NOT NULL,
  is_paid         boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, holiday_on, name)
);

-- kind: leave_type | win_reason | lost_reason | skill | compliance_type | work_order_type
CREATE TABLE IF NOT EXISTS public.org_catalog_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind            text NOT NULL,
  slug            text NOT NULL,
  label           text NOT NULL,
  color           text,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, kind, slug)
);

CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type     text NOT NULL,
  field_key       text NOT NULL,
  label           text NOT NULL,
  field_type      text NOT NULL DEFAULT 'text',
  options         jsonb NOT NULL DEFAULT '[]'::jsonb,
  required        boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, entity_type, field_key),
  CONSTRAINT custom_field_entity_chk CHECK (entity_type IN ('employee', 'client', 'lead', 'work_order', 'project')),
  CONSTRAINT custom_field_type_chk CHECK (field_type IN ('text', 'number', 'date', 'select', 'boolean'))
);

CREATE TABLE IF NOT EXISTS public.custom_field_values (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  definition_id   uuid NOT NULL REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE,
  entity_id       uuid NOT NULL,
  value_text      text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (definition_id, entity_id)
);

CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.checklist_template_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id     uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  label           text NOT NULL,
  required        boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.tactic_checklist_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tactic_id       uuid NOT NULL REFERENCES public.tactics(id) ON DELETE CASCADE,
  template_item_id uuid REFERENCES public.checklist_template_items(id) ON DELETE SET NULL,
  label           text NOT NULL,
  required        boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  completed       boolean NOT NULL DEFAULT false,
  completed_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at    timestamptz
);

CREATE TABLE IF NOT EXISTS public.lead_follow_ups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id         uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  due_on          date NOT NULL,
  note            text,
  assigned_to     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at    timestamptz,
  created_by      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.compliance_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  type_id         uuid REFERENCES public.org_catalog_items(id) ON DELETE SET NULL,
  title           text NOT NULL,
  expires_on      date,
  notes           text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_recurring_jobs (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title                  text NOT NULL,
  description            text,
  project_id             uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  assigned_to            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  checklist_template_id  uuid REFERENCES public.checklist_templates(id) ON DELETE SET NULL,
  work_order_type_id     uuid REFERENCES public.org_catalog_items(id) ON DELETE SET NULL,
  priority               public.tactic_priority NOT NULL DEFAULT 'medium',
  estimated_hours        numeric,
  frequency              text NOT NULL DEFAULT 'weekly',
  interval_n             integer NOT NULL DEFAULT 1,
  next_run_on            date NOT NULL,
  last_run_on            date,
  is_active              boolean NOT NULL DEFAULT true,
  created_by             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recurring_freq_chk CHECK (frequency IN ('daily', 'weekly', 'monthly'))
);

CREATE TABLE IF NOT EXISTS public.employee_skills (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id        uuid NOT NULL REFERENCES public.org_catalog_items(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, skill_id)
);

-- FKs that needed the new tables first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_location_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_location_id_fkey
      FOREIGN KEY (location_id) REFERENCES public.org_locations(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_requests_leave_type_id_fkey'
  ) THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT leave_requests_leave_type_id_fkey
      FOREIGN KEY (leave_type_id) REFERENCES public.org_catalog_items(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tactics_checklist_template_id_fkey'
  ) THEN
    ALTER TABLE public.tactics
      ADD CONSTRAINT tactics_checklist_template_id_fkey
      FOREIGN KEY (checklist_template_id) REFERENCES public.checklist_templates(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tactics_work_order_type_id_fkey'
  ) THEN
    ALTER TABLE public.tactics
      ADD CONSTRAINT tactics_work_order_type_id_fkey
      FOREIGN KEY (work_order_type_id) REFERENCES public.org_catalog_items(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tactics_location_id_fkey'
  ) THEN
    ALTER TABLE public.tactics
      ADD CONSTRAINT tactics_location_id_fkey
      FOREIGN KEY (location_id) REFERENCES public.org_locations(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ============================================================
-- C. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_org_locations_org ON public.org_locations (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_holidays_org_date ON public.org_holidays (organization_id, holiday_on);
CREATE INDEX IF NOT EXISTS idx_org_catalog_org_kind ON public.org_catalog_items (organization_id, kind, is_active);
CREATE INDEX IF NOT EXISTS idx_custom_field_defs_org ON public.custom_field_definitions (organization_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_custom_field_vals_entity ON public.custom_field_values (entity_id);
CREATE INDEX IF NOT EXISTS idx_checklist_tpl_org ON public.checklist_templates (organization_id);
CREATE INDEX IF NOT EXISTS idx_tactic_checklist_tactic ON public.tactic_checklist_items (tactic_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_due ON public.lead_follow_ups (organization_id, due_on) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_compliance_expires ON public.compliance_records (organization_id, expires_on);
CREATE INDEX IF NOT EXISTS idx_recurring_jobs_next ON public.org_recurring_jobs (organization_id, next_run_on) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON public.leads (organization_id, next_follow_up_at);


-- ============================================================
-- D. Seed defaults for a workspace
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_org_workspace_defaults(p_org_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.org_catalog_items (organization_id, kind, slug, label, sort_order, meta)
  VALUES
    (p_org_id, 'leave_type', 'vacation',     'Vacation',     10, '{"paid": true}'::jsonb),
    (p_org_id, 'leave_type', 'sick',         'Sick',         20, '{"paid": true}'::jsonb),
    (p_org_id, 'leave_type', 'personal',     'Personal',     30, '{"paid": true}'::jsonb),
    (p_org_id, 'leave_type', 'unpaid',       'Unpaid',       40, '{"paid": false}'::jsonb),
    (p_org_id, 'leave_type', 'bereavement',  'Bereavement',  50, '{"paid": true}'::jsonb),
    (p_org_id, 'leave_type', 'holiday',      'Holiday',      60, '{"paid": true}'::jsonb),
    (p_org_id, 'win_reason',  'price',        'Price',        10, '{}'::jsonb),
    (p_org_id, 'win_reason',  'relationship', 'Relationship', 20, '{}'::jsonb),
    (p_org_id, 'win_reason',  'product_fit',  'Product fit',  30, '{}'::jsonb),
    (p_org_id, 'win_reason',  'other',        'Other',        90, '{}'::jsonb),
    (p_org_id, 'lost_reason', 'price',        'Price',        10, '{}'::jsonb),
    (p_org_id, 'lost_reason', 'competitor',   'Competitor',   20, '{}'::jsonb),
    (p_org_id, 'lost_reason', 'timing',       'Timing',       30, '{}'::jsonb),
    (p_org_id, 'lost_reason', 'no_response',  'No response',  40, '{}'::jsonb),
    (p_org_id, 'lost_reason', 'other',        'Other',        90, '{}'::jsonb),
    (p_org_id, 'compliance_type', 'drivers_license', 'Driver license', 10, '{"default_valid_days": 365}'::jsonb),
    (p_org_id, 'compliance_type', 'insurance',       'Insurance',      20, '{"default_valid_days": 365}'::jsonb),
    (p_org_id, 'compliance_type', 'contract',        'Contract',       30, '{"default_valid_days": 365}'::jsonb),
    (p_org_id, 'compliance_type', 'certification',   'Certification',  40, '{"default_valid_days": 365}'::jsonb),
    (p_org_id, 'work_order_type', 'standard', 'Standard job', 10, '{}'::jsonb)
  ON CONFLICT (organization_id, kind, slug) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_seed_org_workspace_defaults()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_org_workspace_defaults(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_org_workspace_defaults ON public.organizations;
CREATE TRIGGER trg_seed_org_workspace_defaults
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_seed_org_workspace_defaults();

-- Existing workspaces
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_org_workspace_defaults(r.id);
  END LOOP;
END $$;


-- ============================================================
-- E. Stamp organization_id + RLS
-- ============================================================

DO $$
DECLARE
  t text;
  pol text;
  tables text[] := ARRAY[
    'org_locations',
    'org_holidays',
    'org_catalog_items',
    'custom_field_definitions',
    'custom_field_values',
    'checklist_templates',
    'checklist_template_items',
    'tactic_checklist_items',
    'lead_follow_ups',
    'compliance_records',
    'org_recurring_jobs',
    'employee_skills'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_00_stamp_organization_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_00_stamp_organization_id BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public._trg_stamp_organization_id()',
      t
    );

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    pol := t || '_org_all';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.same_org(organization_id)) WITH CHECK (public.same_org(organization_id))',
      pol, t
    );

    pol := t || '_tenant_isolation';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.same_org(organization_id)) WITH CHECK (public.same_org(organization_id))',
      pol, t
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.org_locations,
  public.org_holidays,
  public.org_catalog_items,
  public.custom_field_definitions,
  public.custom_field_values,
  public.checklist_templates,
  public.checklist_template_items,
  public.tactic_checklist_items,
  public.lead_follow_ups,
  public.compliance_records,
  public.org_recurring_jobs,
  public.employee_skills
TO authenticated;

GRANT EXECUTE ON FUNCTION public.seed_org_workspace_defaults(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
