-- Training modules: sequenced learning materials + optional knowledge tests + progress

CREATE TABLE public.training_modules (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text        NOT NULL,
  description     text,
  sequence_order  integer     NOT NULL DEFAULT 0,
  file_path       text,
  file_name       text,
  file_type       text,
  file_size       bigint,
  has_test        boolean     NOT NULL DEFAULT false,
  pass_percent    integer     NOT NULL DEFAULT 80
                              CHECK (pass_percent BETWEEN 1 AND 100),
  is_published    boolean     NOT NULL DEFAULT true,
  created_by      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.training_modules IS
  'Sequenced training modules (PDF/PPT/DOC) with optional knowledge tests.';

CREATE INDEX idx_training_modules_order ON public.training_modules(sequence_order);
CREATE INDEX idx_training_modules_published ON public.training_modules(is_published);

CREATE TRIGGER training_modules_updated_at
  BEFORE UPDATE ON public.training_modules
  FOR EACH ROW EXECUTE FUNCTION public._trg_set_updated_at();

-- Knowledge-test questions (options stored as jsonb)
-- options shape: [{ "id": "a", "text": "…", "is_correct": true }, …]
CREATE TABLE public.training_questions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id      uuid        NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  question_text  text        NOT NULL,
  options        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  order_no       integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_training_questions_module ON public.training_questions(module_id, order_no);

-- Per-employee progress
CREATE TABLE public.training_progress (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id    uuid        NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  employee_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'in_progress'
                           CHECK (status IN ('in_progress', 'completed')),
  test_score   numeric(5,2),
  test_passed  boolean,
  started_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (module_id, employee_id)
);

CREATE INDEX idx_training_progress_employee ON public.training_progress(employee_id);
CREATE INDEX idx_training_progress_module   ON public.training_progress(module_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.training_modules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_progress  ENABLE ROW LEVEL SECURITY;

-- Modules: admin full access
CREATE POLICY "tm_admin_all" ON public.training_modules
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

-- Modules: everyone can read published
CREATE POLICY "tm_select_published" ON public.training_modules
  FOR SELECT TO authenticated
  USING (is_published = true OR get_my_role() = 'admin');

-- Questions: admin full access
CREATE POLICY "tq_admin_all" ON public.training_questions
  FOR ALL TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

-- Questions: read for published modules (correct answers stripped in app layer)
CREATE POLICY "tq_select_published" ON public.training_questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.training_modules m
      WHERE m.id = module_id
        AND (m.is_published = true OR get_my_role() = 'admin')
    )
  );

-- Progress: admin read all
CREATE POLICY "tp_admin_select" ON public.training_progress
  FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

-- Progress: own rows
CREATE POLICY "tp_own_select" ON public.training_progress
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "tp_own_insert" ON public.training_progress
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "tp_own_update" ON public.training_progress
  FOR UPDATE TO authenticated
  USING  (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

-- Manager can view team progress (direct reports by manager_id)
CREATE POLICY "tp_manager_select" ON public.training_progress
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'manager'
    AND employee_id IN (
      SELECT id FROM public.profiles WHERE manager_id = auth.uid()
    )
  );
