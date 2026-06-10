-- Baseline security/policy audit for project xdpyaytnqxqannsxeopr.
--
-- Purpose:
-- 1) Assert the expected table set exists.
-- 2) Assert no direct anon/authenticated grants on backend-owned business tables.
-- 3) Assert RLS and baseline policies exist for direct-auth tables (profiles, attendance).
--
-- This migration is intentionally assertive: if drift exists, it fails loudly.

begin;

-- 1) Expected tables in public schema
DO $$
DECLARE
  expected_tables text[] := ARRAY[
    'User',
    'Class',
    'ClassSignup',
    'Payment',
    'Workout',
    'Announcement',
    'DeviceToken',
    '_prisma_migrations',
    'profiles',
    'attendance'
  ];
  missing_tables text[];
BEGIN
  SELECT array_agg(t)
  INTO missing_tables
  FROM unnest(expected_tables) AS t
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.tables ist
    WHERE ist.table_schema = 'public'
      AND ist.table_name = t
  );

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Missing expected public tables: %', missing_tables;
  END IF;
END
$$;

-- 2) Backend-owned tables must not expose direct grants to anon/authenticated.
DO $$
DECLARE
  restricted_tables text[] := ARRAY[
    'User',
    'Class',
    'ClassSignup',
    'Payment',
    'Workout',
    'Announcement',
    'DeviceToken',
    '_prisma_migrations'
  ];
  violation_count bigint;
BEGIN
  SELECT count(*)
  INTO violation_count
  FROM information_schema.role_table_grants g
  WHERE g.table_schema = 'public'
    AND g.table_name = ANY(restricted_tables)
    AND g.grantee IN ('anon', 'authenticated');

  IF violation_count > 0 THEN
    RAISE EXCEPTION 'Found % unexpected anon/authenticated grants on backend-owned tables', violation_count;
  END IF;
END
$$;

-- 3a) RLS must be enabled for auth-direct tables.
DO $$
DECLARE
  rls_profiles boolean;
  rls_attendance boolean;
BEGIN
  SELECT c.relrowsecurity
  INTO rls_profiles
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'profiles'
    AND c.relkind = 'r';

  SELECT c.relrowsecurity
  INTO rls_attendance
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'attendance'
    AND c.relkind = 'r';

  IF coalesce(rls_profiles, false) = false THEN
    RAISE EXCEPTION 'RLS must be enabled on public.profiles';
  END IF;

  IF coalesce(rls_attendance, false) = false THEN
    RAISE EXCEPTION 'RLS must be enabled on public.attendance';
  END IF;
END
$$;

-- 3b) Baseline policies must exist (additional policies are allowed).
DO $$
DECLARE
  expected_profiles_policies text[] := ARRAY[
    'Insert own policy (WITH CHECK)',
    'Read own profile'
  ];
  expected_attendance_policies text[] := ARRAY[
    'Admins can manage attendance',
    'Admins can view all attendance',
    'Users can view their own attendance'
  ];
  missing_profiles text[];
  missing_attendance text[];
BEGIN
  SELECT array_agg(p)
  INTO missing_profiles
  FROM unnest(expected_profiles_policies) AS p
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_policies pol
    WHERE pol.schemaname = 'public'
      AND pol.tablename = 'profiles'
      AND pol.policyname = p
  );

  IF missing_profiles IS NOT NULL THEN
    RAISE EXCEPTION 'Missing expected profiles policies: %', missing_profiles;
  END IF;

  SELECT array_agg(p)
  INTO missing_attendance
  FROM unnest(expected_attendance_policies) AS p
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_policies pol
    WHERE pol.schemaname = 'public'
      AND pol.tablename = 'attendance'
      AND pol.policyname = p
  );

  IF missing_attendance IS NOT NULL THEN
    RAISE EXCEPTION 'Missing expected attendance policies: %', missing_attendance;
  END IF;
END
$$;

commit;
