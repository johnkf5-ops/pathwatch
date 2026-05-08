BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO extensions, public;

SELECT plan(6);

-- Each table must be in the supabase_realtime publication
SELECT is(
  (SELECT count(*)::int
     FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'events'),
  1,
  'events is in supabase_realtime publication'
);
SELECT is(
  (SELECT count(*)::int
     FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'snapshots'),
  1,
  'snapshots is in supabase_realtime publication'
);
SELECT is(
  (SELECT count(*)::int
     FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'country_stats'),
  1,
  'country_stats is in supabase_realtime publication'
);

SELECT is(
  (SELECT count(*)::int
     FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'cases'),
  1,
  'cases is in supabase_realtime publication'
);
SELECT is(
  (SELECT count(*)::int
     FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'case_locations'),
  1,
  'case_locations is in supabase_realtime publication'
);
SELECT is(
  (SELECT count(*)::int
     FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'facts'),
  1,
  'facts is in supabase_realtime publication'
);

SELECT * FROM finish();
ROLLBACK;
