-- ============================================================
-- SQL SCHEMA FOR METIS UTDANNING ELEVHUB I SUPABASE
-- Kjør denne koden i Supabase SQL Editor (SQL Editor -> New query)
-- ============================================================

-- 0. FJERN EVENTUELLE EKSISTERENDE TABELLER (hindrer typekonflikter som text vs uuid)
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.materials CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.subjects CASCADE;

-- 1. FAG (subjects)
CREATE TABLE public.subjects (
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
CREATE TABLE public.students (
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
CREATE TABLE public.materials (
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
CREATE TABLE public.assignments (
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
CREATE TABLE public.sessions (
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

-- INDEKSER FOR HØY YTELSE
CREATE INDEX IF NOT EXISTS idx_students_owner ON public.students(owner_email);
CREATE INDEX IF NOT EXISTS idx_materials_subject ON public.materials(subject_id);
CREATE INDEX IF NOT EXISTS idx_assignments_student ON public.assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_material ON public.assignments(material_id);
CREATE INDEX IF NOT EXISTS idx_sessions_student ON public.sessions(student_id);

-- AKTIVER ROW LEVEL SECURITY (RLS)
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- ÅPNE RETTIGHETER FOR ANON OG INNLOGGEDE BRUKERE
DROP POLICY IF EXISTS "Allow public full access on subjects" ON public.subjects;
CREATE POLICY "Allow public full access on subjects" ON public.subjects FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access on students" ON public.students;
CREATE POLICY "Allow public full access on students" ON public.students FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access on materials" ON public.materials;
CREATE POLICY "Allow public full access on materials" ON public.materials FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access on assignments" ON public.assignments;
CREATE POLICY "Allow public full access on assignments" ON public.assignments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access on sessions" ON public.sessions;
CREATE POLICY "Allow public full access on sessions" ON public.sessions FOR ALL USING (true) WITH CHECK (true);

-- SANNTIDSSYSTEM (Realtime replication - trygt lagt til uten duplikatfeil)
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['subjects', 'students', 'materials', 'assignments', 'sessions'])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;
