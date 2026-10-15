-- Non-destructive setup for Tutoring Assistant. Existing rows are preserved.
-- 1. FAG (subjects)
CREATE TABLE IF NOT EXISTS public.subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  color TEXT DEFAULT '#0f172a',
  grade_level TEXT,
  description TEXT,
  owner_email TEXT DEFAULT 'birkhaugnes@gmail.com',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. ELEVER (students)
CREATE TABLE IF NOT EXISTS public.students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  active_subject_ids JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT DEFAULT 'aktiv',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  owner_email TEXT DEFAULT 'birkhaugnes@gmail.com'
);

-- 3. MATERIALBANK (materials)
CREATE TABLE IF NOT EXISTS public.materials (
  id TEXT PRIMARY KEY,
  subject_id TEXT REFERENCES public.subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'oppgave',
  description TEXT,
  topic TEXT,
  curriculum_goals JSONB DEFAULT '[]'::jsonb,
  files JSONB DEFAULT '[]'::jsonb,
  external_links JSONB DEFAULT '[]'::jsonb,
  is_exam_relevant BOOLEAN DEFAULT false,
  grade_level TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  owner_email TEXT DEFAULT 'birkhaugnes@gmail.com'
);

-- 4. OPPGAVESTATUS & GJENNOMGANGER (assignments)
CREATE TABLE IF NOT EXISTS public.assignments (
  id TEXT PRIMARY KEY,
  student_id TEXT REFERENCES public.students(id) ON DELETE CASCADE,
  material_id TEXT REFERENCES public.materials(id) ON DELETE CASCADE,
  assigned_date TEXT,
  due_date TEXT,
  completed_date TEXT,
  status TEXT DEFAULT 'ikke_tildelt',
  score TEXT,
  notes TEXT,
  feedback TEXT,
  owner_email TEXT DEFAULT 'birkhaugnes@gmail.com',
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. VEILEDNINGSTIMER & PLANER (sessions)
CREATE TABLE IF NOT EXISTS public.sessions (
  id TEXT PRIMARY KEY,
  student_id TEXT REFERENCES public.students(id) ON DELETE SET NULL,
  student_name TEXT,
  subject_id TEXT,
  subject_name TEXT,
  date TEXT NOT NULL,
  time TEXT,
  duration_minutes INTEGER DEFAULT 60,
  planned_topics TEXT,
  completed_topics TEXT,
  next_steps TEXT,
  teacher_notes TEXT,
  owner_email TEXT DEFAULT 'birkhaugnes@gmail.com',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- Full typed application records and stable Supabase user ownership.
DO $$
DECLARE tbl text; pol record;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['subjects','students','materials','assignments','sessions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT %L::jsonb', tbl, '{}');
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid()', tbl);
    EXECUTE format('UPDATE public.%I t SET owner_id = u.id FROM auth.users u WHERE t.owner_id IS NULL AND lower(t.owner_email) = lower(u.email)', tbl);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN owner_email DROP DEFAULT', tbl);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (id, owner_id)', tbl || '_id_owner_unique', tbl);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (owner_id)', tbl || '_owner_id_idx', tbl);
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tbl LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, tbl);
    END LOOP;
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, PUBLIC', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);
    EXECUTE format('CREATE POLICY own_rows_select ON public.%I FOR SELECT TO authenticated USING ((select auth.uid()) = owner_id)', tbl);
    EXECUTE format('CREATE POLICY own_rows_insert ON public.%I FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = owner_id)', tbl);
    EXECUTE format('CREATE POLICY own_rows_update ON public.%I FOR UPDATE TO authenticated USING ((select auth.uid()) = owner_id) WITH CHECK ((select auth.uid()) = owner_id)', tbl);
    EXECUTE format('CREATE POLICY own_rows_delete ON public.%I FOR DELETE TO authenticated USING ((select auth.uid()) = owner_id)', tbl);
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=tbl) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;

-- A row cannot point at a different teacher's parent records.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='materials_subject_owner_fk') THEN
    ALTER TABLE public.materials ADD CONSTRAINT materials_subject_owner_fk FOREIGN KEY (subject_id, owner_id) REFERENCES public.subjects(id, owner_id) ON DELETE CASCADE;
    ALTER TABLE public.assignments ADD CONSTRAINT assignments_student_owner_fk FOREIGN KEY (student_id, owner_id) REFERENCES public.students(id, owner_id) ON DELETE CASCADE;
    ALTER TABLE public.assignments ADD CONSTRAINT assignments_material_owner_fk FOREIGN KEY (material_id, owner_id) REFERENCES public.materials(id, owner_id) ON DELETE CASCADE;
    ALTER TABLE public.sessions ADD CONSTRAINT sessions_student_owner_fk FOREIGN KEY (student_id, owner_id) REFERENCES public.students(id, owner_id) ON DELETE CASCADE;
    ALTER TABLE public.sessions ADD CONSTRAINT sessions_subject_owner_fk FOREIGN KEY (subject_id, owner_id) REFERENCES public.subjects(id, owner_id) ON DELETE CASCADE;
  END IF;
END $$;

-- The unused legacy table is kept, with no client access.
ALTER TABLE IF EXISTS public.student_sessions ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE pol record;
BEGIN
  IF to_regclass('public.student_sessions') IS NOT NULL THEN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='student_sessions' LOOP
      EXECUTE format('DROP POLICY %I ON public.student_sessions', pol.policyname);
    END LOOP;
    REVOKE ALL ON public.student_sessions FROM anon, authenticated, PUBLIC;
  END IF;
END $$;

-- Private attachments, with the authenticated user's UUID as the first path segment.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('material-files', 'material-files', false, 20971520)
ON CONFLICT (id) DO UPDATE SET public=false, file_size_limit=20971520;
DROP POLICY IF EXISTS metis_files_select ON storage.objects;
DROP POLICY IF EXISTS metis_files_insert ON storage.objects;
DROP POLICY IF EXISTS metis_files_update ON storage.objects;
DROP POLICY IF EXISTS metis_files_delete ON storage.objects;
CREATE POLICY metis_files_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='material-files' AND (storage.foldername(name))[1] = (select auth.uid())::text);
CREATE POLICY metis_files_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='material-files' AND (storage.foldername(name))[1] = (select auth.uid())::text);
CREATE POLICY metis_files_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='material-files' AND (storage.foldername(name))[1] = (select auth.uid())::text)
WITH CHECK (bucket_id='material-files' AND (storage.foldername(name))[1] = (select auth.uid())::text);
CREATE POLICY metis_files_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='material-files' AND (storage.foldername(name))[1] = (select auth.uid())::text);
