BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO extensions, public;

SELECT plan(12);

-- Seed one row in each public table from a privileged role so anon has something to read
INSERT INTO events (title, summary, source_type, category)
  VALUES ('rls-fixture','rls-fixture','x','case_report');
INSERT INTO snapshots (disease) VALUES ('hantavirus');
INSERT INTO country_stats (disease, country_code, country_name)
  VALUES ('hantavirus','ZZ','Fixture');
INSERT INTO scrape_log (source_type) VALUES ('x');

-- RLS enabled on all four tables
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'events'),
  true,
  'RLS enabled on events'
);
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'snapshots'),
  true,
  'RLS enabled on snapshots'
);
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'country_stats'),
  true,
  'RLS enabled on country_stats'
);
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'scrape_log'),
  true,
  'RLS enabled on scrape_log'
);

-- Switch to anon and verify
SET ROLE anon;

SELECT cmp_ok(
  (SELECT count(*)::int FROM events), '>=', 1,
  'anon can SELECT events'
);
SELECT cmp_ok(
  (SELECT count(*)::int FROM snapshots), '>=', 1,
  'anon can SELECT snapshots'
);
SELECT cmp_ok(
  (SELECT count(*)::int FROM country_stats), '>=', 1,
  'anon can SELECT country_stats'
);

SELECT throws_ok(
  $$INSERT INTO events (title, summary, source_type, category) VALUES ('x','y','x','case_report')$$,
  '42501',
  NULL,
  'anon cannot INSERT events'
);
SELECT throws_ok(
  $$INSERT INTO snapshots (disease) VALUES ('hantavirus')$$,
  '42501',
  NULL,
  'anon cannot INSERT snapshots'
);
SELECT throws_ok(
  $$INSERT INTO country_stats (disease, country_code, country_name) VALUES ('hantavirus','YY','y')$$,
  '42501',
  NULL,
  'anon cannot INSERT country_stats'
);

-- scrape_log: RLS on, no policy → anon sees zero rows
SELECT is(
  (SELECT count(*)::int FROM scrape_log), 0,
  'anon sees no scrape_log rows'
);
SELECT throws_ok(
  $$INSERT INTO scrape_log (source_type) VALUES ('x')$$,
  '42501',
  NULL,
  'anon cannot INSERT scrape_log'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
