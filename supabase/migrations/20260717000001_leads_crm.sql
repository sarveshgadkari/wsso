-- =============================================================================
-- CRM: leads table (shared across marketing sites, written by their
-- /api/leads route using the service_role key) + admin/employee access.
-- =============================================================================

-- Table already exists in the live project (created directly via SQL editor
-- for the website enquiry forms) — this mirrors it here so it's tracked.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  website_name text not null,
  website_url text not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  company text,
  inquiry_type text,
  message text not null,
  source text,
  page_path text,
  created_at timestamptz not null default now()
);

create index if not exists leads_website_url_idx on public.leads (website_url);

alter table public.leads enable row level security;

-- ── CRM workflow status ──────────────────────────────────────────────────────

CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'converted', 'lost');

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS status public.lead_status NOT NULL DEFAULT 'new';

CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);

-- ── Assignment (many employees per lead) ────────────────────────────────────

CREATE TABLE public.lead_assignments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  employee_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, employee_id)
);

COMMENT ON TABLE public.lead_assignments IS
  'Which employees (any role) are working a given lead. Many-to-many.';

CREATE INDEX idx_la_lead_id     ON public.lead_assignments(lead_id);
CREATE INDEX idx_la_employee_id ON public.lead_assignments(employee_id);

ALTER TABLE public.lead_assignments ENABLE ROW LEVEL SECURITY;

-- ── RLS: leads ───────────────────────────────────────────────────────────────
-- Note: the enquiry-form API route uses the service_role key (bypasses RLS),
-- so it keeps writing new leads regardless of these policies.

CREATE POLICY "leads_admin_all" ON public.leads
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

-- Anyone assigned to a lead can see it and update its status
CREATE POLICY "leads_assigned_select" ON public.leads
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT lead_id FROM public.lead_assignments WHERE employee_id = auth.uid())
  );

CREATE POLICY "leads_assigned_update" ON public.leads
  FOR UPDATE TO authenticated
  USING (
    id IN (SELECT lead_id FROM public.lead_assignments WHERE employee_id = auth.uid())
  )
  WITH CHECK (
    id IN (SELECT lead_id FROM public.lead_assignments WHERE employee_id = auth.uid())
  );

-- ── RLS: lead_assignments ────────────────────────────────────────────────────

CREATE POLICY "la_admin_all" ON public.lead_assignments
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

CREATE POLICY "la_assignee_select" ON public.lead_assignments
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

-- Refresh PostgREST schema cache so the API sees the new table/columns immediately
NOTIFY pgrst, 'reload schema';
