-- Run against the project with execute_sql. Every fixture is rolled back.
BEGIN;
INSERT INTO auth.users(id,email) VALUES
('00000000-0000-4000-8000-000000000001','teacher-a@example.test'),
('00000000-0000-4000-8000-000000000002','teacher-b@example.test');
INSERT INTO public.subjects(id,name,code,owner_id,owner_email) VALUES
('rls-test-a','A','A','00000000-0000-4000-8000-000000000001','teacher-a@example.test'),
('rls-test-b','B','B','00000000-0000-4000-8000-000000000002','teacher-b@example.test');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $$
DECLARE affected int;
BEGIN
  IF (SELECT count(*) FROM public.subjects WHERE id LIKE 'rls-test-%') <> 1 THEN RAISE EXCEPTION 'Cross-user SELECT isolation failed'; END IF;
  INSERT INTO public.students(id,name,owner_id) VALUES ('rls-test-own','Test','00000000-0000-4000-8000-000000000001');
  BEGIN
    UPDATE public.students SET owner_id='00000000-0000-4000-8000-000000000002' WHERE id='rls-test-own';
    RAISE EXCEPTION 'Owner transfer was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.students(id,name,owner_id) VALUES ('rls-test-spoof','Test','00000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'Spoofed owner insert was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.materials(id,title,subject_id,owner_id) VALUES ('rls-test-link','Test','rls-test-b','00000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'Cross-user parent reference was allowed';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  DELETE FROM public.subjects WHERE id='rls-test-b';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Cross-user DELETE was allowed'; END IF;
END $$;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM id FROM public.students LIMIT 1;
    RAISE EXCEPTION 'Anonymous read was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.students(id,name) VALUES ('rls-test-anon','Test');
    RAISE EXCEPTION 'Anonymous write was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;
SELECT 'PASS: user isolation, spoofed ownership, owner transfer, cross-user references, anonymous read/write' AS result;
