-- =============================================================================
-- WSSO Phase 1 — Full Database Schema
-- Migration : 20260625000000_initial_schema.sql
--
-- Execution order:
--   0. Enums
--   1. Helper functions (SECURITY DEFINER — used inside RLS policies)
--   2. Auto-code sequences + formatter
--   3. Core tables  (companies → profiles → teams → FK back-fill → rest)
--   4. Triggers     (auto-code, updated_at, duration_minutes)
--   5. Indexes
--   6. Row Level Security
-- =============================================================================


-- ============================================================
-- 0. ENUMS
-- ============================================================

CREATE TYPE public.user_role AS ENUM ('admin', 'director', 'manager', 'employee');

CREATE TYPE public.profile_status AS ENUM ('active', 'inactive');

CREATE TYPE public.project_status AS ENUM ('active', 'on_hold', 'completed');

CREATE TYPE public.tactic_priority AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE public.tactic_status AS ENUM (
  'assigned', 'in_progress', 'review', 'done', 'archived'
);

CREATE TYPE public.client_status AS ENUM ('active', 'inactive');

CREATE TYPE public.clock_close_reason AS ENUM (
  'manual', 'auto_logout', 'admin_correction'
);


-- ============================================================
-- 1. HELPER FUNCTIONS
-- ============================================================
-- These run as SECURITY DEFINER so they can read `profiles`
-- without triggering recursive RLS evaluation.  Always set
-- search_path explicitly to prevent search-path injection.

CREATE OR REPLACE FUNCTION public.get_my_role()
  RETURNS public.user_role
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT role
    FROM   public.profiles
    WHERE  id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_team_id()
  RETURNS uuid
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT team_id
    FROM   public.profiles
    WHERE  id = auth.uid()
  );
END;
$$;

-- Convenience: return the authenticated user's employee_code
CREATE OR REPLACE FUNCTION public.get_my_employee_code()
  RETURNS text
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT employee_code
    FROM   public.profiles
    WHERE  id = auth.uid()
  );
END;
$$;


-- ============================================================
-- 2. AUTO-CODE SEQUENCES + FORMATTER
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS public.seq_emp_code START 1;   -- EMP001…
CREATE SEQUENCE IF NOT EXISTS public.seq_tlb_code START 1;   -- TLB001… (companies)
CREATE SEQUENCE IF NOT EXISTS public.seq_cli_code START 1;   -- CLI001… (clients)
CREATE SEQUENCE IF NOT EXISTS public.seq_prj_code START 1;   -- PRJ001… (projects)
CREATE SEQUENCE IF NOT EXISTS public.seq_tac_code START 1;   -- TAC001… (tactics)

-- Format a sequence value as PREFIX + zero-padded number.
-- Default pad = 3  →  EMP001.  Pass pad = 4 for >999 records.
CREATE OR REPLACE FUNCTION public.fmt_code(prefix text, n bigint, pad int DEFAULT 3)
  RETURNS text LANGUAGE sql IMMUTABLE AS
$$
  SELECT prefix || lpad(n::text, pad, '0');
$$;


-- ============================================================
-- 3. CORE TABLES
-- ============================================================
-- Dependency order:
--   companies  (no deps)
--   profiles   (→ auth.users; team_id/manager_id FKs added AFTER teams)
--   teams      (→ companies, profiles)
--   [ALTER profiles to add team_id FK]
--   employee_companies, clients, projects, tactics,
--   activity_logs, time_logs, documents, notifications

-- ------------------------------------------------------------
-- 3a. companies
-- ------------------------------------------------------------
CREATE TABLE public.companies (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text        UNIQUE NOT NULL,
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.companies          IS 'Top-level business entities.';
COMMENT ON COLUMN public.companies.code     IS 'Auto-generated: TLB001, TLB002 …';

-- ------------------------------------------------------------
-- 3b. profiles
-- (team_id / manager_id FKs are deferred until after teams exists)
-- ------------------------------------------------------------
CREATE TABLE public.profiles (
  id            uuid               PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_code text               UNIQUE NOT NULL,
  full_name     text               NOT NULL,
  email         text               NOT NULL,
  phone         text,
  role          public.user_role   NOT NULL DEFAULT 'employee',
  manager_id    uuid,              -- FK to profiles.id added below
  team_id       uuid,              -- FK to teams.id added below
  department    text,
  status        public.profile_status NOT NULL DEFAULT 'active',
  created_at    timestamptz        NOT NULL DEFAULT now(),
  updated_at    timestamptz        NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.profiles               IS 'One row per auth user; synced on sign-up.';
COMMENT ON COLUMN public.profiles.employee_code IS 'Auto-generated: EMP001, EMP002 …';
COMMENT ON COLUMN public.profiles.manager_id    IS 'Direct line-manager (self-reference).';

-- ------------------------------------------------------------
-- 3c. teams
-- (manager_id → profiles; company_id → companies)
-- ------------------------------------------------------------
CREATE TABLE public.teams (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text        UNIQUE NOT NULL,
  name       text        NOT NULL,
  company_id uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  manager_id uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.teams            IS 'Groups of employees within a company.';
COMMENT ON COLUMN public.teams.manager_id IS 'The profile who manages this team.';

-- Now that `teams` exists, add the back-FKs on profiles
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_manager_id_fkey
    FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT profiles_team_id_fkey
    FOREIGN KEY (team_id)    REFERENCES public.teams(id)    ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 3d. employee_companies  (many-to-many)
-- ------------------------------------------------------------
CREATE TABLE public.employee_companies (
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  PRIMARY KEY (employee_id, company_id)
);

-- ------------------------------------------------------------
-- 3e. clients
-- ------------------------------------------------------------
CREATE TABLE public.clients (
  id            uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text               UNIQUE NOT NULL,
  name          text               NOT NULL,
  contact_name  text,
  contact_email text,
  contact_phone text,
  company_id    uuid               NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status        public.client_status NOT NULL DEFAULT 'active',
  created_at    timestamptz        NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.clients.code IS 'Auto-generated: CLI001, CLI002 …';

-- ------------------------------------------------------------
-- 3f. projects
-- ------------------------------------------------------------
CREATE TABLE public.projects (
  id         uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text                 UNIQUE NOT NULL,
  name       text                 NOT NULL,
  company_id uuid                 NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id  uuid                 REFERENCES public.clients(id)  ON DELETE SET NULL,
  manager_id uuid                 REFERENCES public.profiles(id) ON DELETE SET NULL,
  status     public.project_status NOT NULL DEFAULT 'active',
  created_at timestamptz          NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.projects.code IS 'Auto-generated: PRJ001, PRJ002 …';

-- ------------------------------------------------------------
-- 3g. tactics  (task / work-order records)
-- ------------------------------------------------------------
CREATE TABLE public.tactics (
  id              uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text                  UNIQUE NOT NULL,
  title           text                  NOT NULL,
  description     text,
  project_id      uuid                  REFERENCES public.projects(id)  ON DELETE SET NULL,
  assigned_to     uuid                  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by      uuid                  NOT NULL REFERENCES public.profiles(id),
  priority        public.tactic_priority NOT NULL DEFAULT 'medium',
  status          public.tactic_status  NOT NULL DEFAULT 'assigned',
  due_date        date,
  estimated_hours numeric(6, 2),
  created_at      timestamptz           NOT NULL DEFAULT now(),
  updated_at      timestamptz           NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.tactics              IS 'Task / work-order records.';
COMMENT ON COLUMN public.tactics.code         IS 'Auto-generated: TAC001, TAC002 …';
COMMENT ON COLUMN public.tactics.project_id   IS 'Nullable — a tactic can exist without a project.';

-- ------------------------------------------------------------
-- 3h. activity_logs
-- ------------------------------------------------------------
CREATE TABLE public.activity_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tactic_id    uuid        NOT NULL REFERENCES public.tactics(id)  ON DELETE CASCADE,
  employee_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action       text        NOT NULL,     -- e.g. "status changed to in_progress"
  hours_logged numeric(6, 2),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 3i. time_logs  (clock-in / clock-out; separate from app auth)
-- ------------------------------------------------------------
CREATE TABLE public.time_logs (
  id               uuid                      PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      uuid                      NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  clock_in_at      timestamptz               NOT NULL DEFAULT now(),
  clock_out_at     timestamptz,
  duration_minutes integer,                  -- calculated by trigger on clock-out
  closed_reason    public.clock_close_reason,
  log_date         date,                -- set by trigger on insert/update from clock_in_at
  created_at       timestamptz               NOT NULL DEFAULT now(),

  CONSTRAINT time_logs_clock_order_chk
    CHECK (clock_out_at IS NULL OR clock_out_at > clock_in_at)
);

COMMENT ON COLUMN public.time_logs.log_date         IS 'Set by trigger from clock_in_at; use for daily GROUP BY.';
COMMENT ON COLUMN public.time_logs.duration_minutes IS 'Set by trigger when clock_out_at is filled.';

-- Partial unique index: one open (un-clocked-out) session per employee
CREATE UNIQUE INDEX time_logs_one_active_session_idx
  ON public.time_logs (employee_id)
  WHERE clock_out_at IS NULL;

-- ------------------------------------------------------------
-- 3j. documents
-- ------------------------------------------------------------
CREATE TABLE public.documents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name     text        NOT NULL,
  file_path     text        NOT NULL,  -- Supabase Storage object path
  file_type     text,                  -- MIME type
  file_size     bigint,                -- bytes
  -- Denormalised codes: fill whichever scopes apply
  company_code  text,
  employee_code text,
  client_code   text,
  project_code  text,
  tactic_code   text,
  uploaded_by   uuid        NOT NULL REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 3k. notifications
-- ------------------------------------------------------------
CREATE TABLE public.notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       text        NOT NULL,
  message    text        NOT NULL,
  link       text,
  is_read    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 4. TRIGGERS
-- ============================================================

-- ---- 4a. Auto-code triggers ------------------------------------

CREATE OR REPLACE FUNCTION public._trg_set_employee_code()
  RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  IF NEW.employee_code IS NULL OR trim(NEW.employee_code) = '' THEN
    NEW.employee_code := public.fmt_code('EMP', nextval('public.seq_emp_code'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_employee_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public._trg_set_employee_code();

-- ----

CREATE OR REPLACE FUNCTION public._trg_set_company_code()
  RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  IF NEW.code IS NULL OR trim(NEW.code) = '' THEN
    NEW.code := public.fmt_code('TLB', nextval('public.seq_tlb_code'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_companies_code
  BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public._trg_set_company_code();

-- ----

CREATE OR REPLACE FUNCTION public._trg_set_client_code()
  RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  IF NEW.code IS NULL OR trim(NEW.code) = '' THEN
    NEW.code := public.fmt_code('CLI', nextval('public.seq_cli_code'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clients_code
  BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public._trg_set_client_code();

-- ----

CREATE OR REPLACE FUNCTION public._trg_set_project_code()
  RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  IF NEW.code IS NULL OR trim(NEW.code) = '' THEN
    NEW.code := public.fmt_code('PRJ', nextval('public.seq_prj_code'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_projects_code
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public._trg_set_project_code();

-- ----

CREATE OR REPLACE FUNCTION public._trg_set_tactic_code()
  RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  IF NEW.code IS NULL OR trim(NEW.code) = '' THEN
    NEW.code := public.fmt_code('TAC', nextval('public.seq_tac_code'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tactics_code
  BEFORE INSERT ON public.tactics
  FOR EACH ROW EXECUTE FUNCTION public._trg_set_tactic_code();


-- ---- 4b. updated_at auto-stamp ---------------------------------

CREATE OR REPLACE FUNCTION public._trg_set_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public._trg_set_updated_at();

CREATE TRIGGER trg_tactics_updated_at
  BEFORE UPDATE ON public.tactics
  FOR EACH ROW EXECUTE FUNCTION public._trg_set_updated_at();


-- ---- 4c. duration_minutes calculator ---------------------------
-- Fires on INSERT (in case both timestamps are supplied at once)
-- and on UPDATE when clock_out_at is set.

CREATE OR REPLACE FUNCTION public._trg_calc_duration()
  RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  -- Always derive log_date from clock_in_at (avoids IMMUTABLE requirement of generated columns)
  NEW.log_date := NEW.clock_in_at::date;

  IF NEW.clock_out_at IS NOT NULL THEN
    NEW.duration_minutes :=
      EXTRACT(EPOCH FROM (NEW.clock_out_at - NEW.clock_in_at))::integer / 60;
  ELSE
    NEW.duration_minutes := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_time_logs_duration
  BEFORE INSERT OR UPDATE ON public.time_logs
  FOR EACH ROW EXECUTE FUNCTION public._trg_calc_duration();


-- ============================================================
-- 5. INDEXES
-- ============================================================
-- All FK columns + the two high-traffic dashboard combos.

-- profiles
CREATE INDEX idx_profiles_manager_id ON public.profiles(manager_id);
CREATE INDEX idx_profiles_team_id    ON public.profiles(team_id);
CREATE INDEX idx_profiles_status     ON public.profiles(status);

-- teams
CREATE INDEX idx_teams_company_id    ON public.teams(company_id);
CREATE INDEX idx_teams_manager_id    ON public.teams(manager_id);

-- employee_companies
CREATE INDEX idx_ec_company_id       ON public.employee_companies(company_id);

-- clients
CREATE INDEX idx_clients_company_id  ON public.clients(company_id);

-- projects
CREATE INDEX idx_projects_company_id ON public.projects(company_id);
CREATE INDEX idx_projects_client_id  ON public.projects(client_id);
CREATE INDEX idx_projects_manager_id ON public.projects(manager_id);
CREATE INDEX idx_projects_status     ON public.projects(status);

-- tactics
CREATE INDEX idx_tactics_project_id  ON public.tactics(project_id);
CREATE INDEX idx_tactics_created_by  ON public.tactics(created_by);
-- Dashboard combo: "my open tasks" query
CREATE INDEX idx_tactics_assignee_status ON public.tactics(assigned_to, status);

-- activity_logs
CREATE INDEX idx_al_tactic_id        ON public.activity_logs(tactic_id);
CREATE INDEX idx_al_employee_id      ON public.activity_logs(employee_id);

-- time_logs
CREATE INDEX idx_tl_employee_id      ON public.time_logs(employee_id);
-- Dashboard combo: daily attendance report
CREATE INDEX idx_tl_employee_date    ON public.time_logs(employee_id, log_date);

-- documents
CREATE INDEX idx_docs_uploaded_by    ON public.documents(uploaded_by);
CREATE INDEX idx_docs_employee_code  ON public.documents(employee_code);
CREATE INDEX idx_docs_project_code   ON public.documents(project_code);
CREATE INDEX idx_docs_tactic_code    ON public.documents(tactic_code);

-- notifications
CREATE INDEX idx_notif_user_unread   ON public.notifications(user_id, is_read);


-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================
-- Strategy:
--   • Helper functions (get_my_role / get_my_team_id) run as
--     SECURITY DEFINER, bypassing RLS when they query profiles
--     → no infinite recursion.
--   • Policies are permissive (OR'd).  We use separate
--     FOR SELECT and FOR ALL policies where a role needs a
--     broader read scope than write scope.
--   • Admin / Director read everything; only Admin can write.
--   • Manager reads everything in their domain; writes only
--     rows that belong to their team.
--   • Employee reads/writes only their own rows.

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tactics            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;


-- ── 6a. PROFILES ─────────────────────────────────────────────

-- Admin: unrestricted
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

-- Director: read only
CREATE POLICY "profiles_director_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (get_my_role() = 'director');

-- Manager: SELECT all; INSERT/UPDATE/DELETE only team members
CREATE POLICY "profiles_manager_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (get_my_role() = 'manager');

CREATE POLICY "profiles_manager_write" ON public.profiles
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'manager'
    AND (team_id = get_my_team_id() OR manager_id = auth.uid())
  )
  WITH CHECK (
    get_my_role() = 'manager'
    AND (team_id = get_my_team_id() OR manager_id = auth.uid())
  );

-- Employee: own row only
CREATE POLICY "profiles_employee_own" ON public.profiles
  FOR ALL TO authenticated
  USING     (id = auth.uid())
  WITH CHECK(id = auth.uid());


-- ── 6b. COMPANIES ────────────────────────────────────────────

CREATE POLICY "companies_admin_all" ON public.companies
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

CREATE POLICY "companies_director_manager_select" ON public.companies
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('director', 'manager'));

-- Employee: only companies they're assigned to
CREATE POLICY "companies_employee_select" ON public.companies
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'employee'
    AND id IN (
      SELECT company_id
      FROM   public.employee_companies
      WHERE  employee_id = auth.uid()
    )
  );


-- ── 6c. TEAMS ────────────────────────────────────────────────

CREATE POLICY "teams_admin_all" ON public.teams
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

CREATE POLICY "teams_director_manager_select" ON public.teams
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('director', 'manager'));

-- Employee: only their own team
CREATE POLICY "teams_employee_select" ON public.teams
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'employee'
    AND id = get_my_team_id()
  );


-- ── 6d. EMPLOYEE_COMPANIES ───────────────────────────────────

CREATE POLICY "ec_admin_all" ON public.employee_companies
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

CREATE POLICY "ec_director_manager_select" ON public.employee_companies
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('director', 'manager'));

CREATE POLICY "ec_employee_own" ON public.employee_companies
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid());


-- ── 6e. CLIENTS ──────────────────────────────────────────────

CREATE POLICY "clients_admin_all" ON public.clients
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

CREATE POLICY "clients_director_manager_select" ON public.clients
  FOR SELECT TO authenticated
  USING (get_my_role() IN ('director', 'manager'));

-- Employee: clients belonging to their companies
CREATE POLICY "clients_employee_select" ON public.clients
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'employee'
    AND company_id IN (
      SELECT company_id
      FROM   public.employee_companies
      WHERE  employee_id = auth.uid()
    )
  );


-- ── 6f. PROJECTS ─────────────────────────────────────────────

CREATE POLICY "projects_admin_all" ON public.projects
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

-- Director: read only
CREATE POLICY "projects_director_select" ON public.projects
  FOR SELECT TO authenticated
  USING (get_my_role() = 'director');

-- Manager: SELECT all; write only projects they own
CREATE POLICY "projects_manager_select" ON public.projects
  FOR SELECT TO authenticated
  USING (get_my_role() = 'manager');

CREATE POLICY "projects_manager_write_own" ON public.projects
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'manager'
    AND manager_id = auth.uid()
  )
  WITH CHECK (
    get_my_role() = 'manager'
    AND manager_id = auth.uid()
  );

-- Employee: projects linked via their tactics or companies
CREATE POLICY "projects_employee_select" ON public.projects
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'employee'
    AND (
      id IN (
        SELECT project_id
        FROM   public.tactics
        WHERE  assigned_to = auth.uid()
        AND    project_id IS NOT NULL
      )
      OR company_id IN (
        SELECT company_id
        FROM   public.employee_companies
        WHERE  employee_id = auth.uid()
      )
    )
  );


-- ── 6g. TACTICS ──────────────────────────────────────────────

CREATE POLICY "tactics_admin_all" ON public.tactics
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

CREATE POLICY "tactics_director_select" ON public.tactics
  FOR SELECT TO authenticated
  USING (get_my_role() = 'director');

-- Manager: full access where assignee is in their team or they created it
CREATE POLICY "tactics_manager_all" ON public.tactics
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'manager'
    AND (
      created_by = auth.uid()
      OR assigned_to IN (
        SELECT id FROM public.profiles WHERE team_id = get_my_team_id()
      )
    )
  )
  WITH CHECK (
    get_my_role() = 'manager'
    AND (
      created_by = auth.uid()
      OR assigned_to IN (
        SELECT id FROM public.profiles WHERE team_id = get_my_team_id()
      )
    )
  );

-- Employee: their assigned tactics (can update status, log hours, etc.)
CREATE POLICY "tactics_employee_own" ON public.tactics
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'employee'
    AND assigned_to = auth.uid()
  )
  WITH CHECK (
    get_my_role() = 'employee'
    AND assigned_to = auth.uid()
  );


-- ── 6h. ACTIVITY_LOGS ────────────────────────────────────────

CREATE POLICY "al_admin_all" ON public.activity_logs
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

CREATE POLICY "al_director_select" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (get_my_role() = 'director');

-- Manager: logs for their team members
CREATE POLICY "al_manager_all" ON public.activity_logs
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'manager'
    AND employee_id IN (
      SELECT id FROM public.profiles WHERE team_id = get_my_team_id()
    )
  )
  WITH CHECK (
    get_my_role() = 'manager'
    AND employee_id IN (
      SELECT id FROM public.profiles WHERE team_id = get_my_team_id()
    )
  );

-- Employee: their own logs
CREATE POLICY "al_employee_own" ON public.activity_logs
  FOR ALL TO authenticated
  USING     (get_my_role() = 'employee' AND employee_id = auth.uid())
  WITH CHECK(get_my_role() = 'employee' AND employee_id = auth.uid());


-- ── 6i. TIME_LOGS ────────────────────────────────────────────

CREATE POLICY "tl_admin_all" ON public.time_logs
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

CREATE POLICY "tl_director_select" ON public.time_logs
  FOR SELECT TO authenticated
  USING (get_my_role() = 'director');

-- Manager: team members' time logs (incl. admin corrections)
CREATE POLICY "tl_manager_all" ON public.time_logs
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'manager'
    AND employee_id IN (
      SELECT id FROM public.profiles WHERE team_id = get_my_team_id()
    )
  )
  WITH CHECK (
    get_my_role() = 'manager'
    AND employee_id IN (
      SELECT id FROM public.profiles WHERE team_id = get_my_team_id()
    )
  );

-- Employee: clock in/out for themselves only
CREATE POLICY "tl_employee_own" ON public.time_logs
  FOR ALL TO authenticated
  USING     (get_my_role() = 'employee' AND employee_id = auth.uid())
  WITH CHECK(get_my_role() = 'employee' AND employee_id = auth.uid());


-- ── 6j. DOCUMENTS ────────────────────────────────────────────

CREATE POLICY "docs_admin_all" ON public.documents
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

CREATE POLICY "docs_director_select" ON public.documents
  FOR SELECT TO authenticated
  USING (get_my_role() = 'director');

-- Manager: documents uploaded by their team
CREATE POLICY "docs_manager_all" ON public.documents
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'manager'
    AND uploaded_by IN (
      SELECT id FROM public.profiles WHERE team_id = get_my_team_id()
    )
  )
  WITH CHECK (
    get_my_role() = 'manager'
    AND uploaded_by IN (
      SELECT id FROM public.profiles WHERE team_id = get_my_team_id()
    )
  );

-- Employee: their own uploads + docs tagged with their employee_code
CREATE POLICY "docs_employee_select" ON public.documents
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'employee'
    AND (
      uploaded_by = auth.uid()
      OR employee_code = get_my_employee_code()
    )
  );

CREATE POLICY "docs_employee_write_own" ON public.documents
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'employee'
    AND uploaded_by = auth.uid()
  )
  WITH CHECK (
    get_my_role() = 'employee'
    AND uploaded_by = auth.uid()
  );


-- ── 6k. NOTIFICATIONS ────────────────────────────────────────

CREATE POLICY "notif_admin_all" ON public.notifications
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

-- Every authenticated user can only see and manage their own notifications
CREATE POLICY "notif_own" ON public.notifications
  FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK(user_id = auth.uid());
