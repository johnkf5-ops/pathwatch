BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO extensions, public;

SELECT plan(18);

SELECT has_table('country_stats');

SELECT has_column('country_stats', 'id');
SELECT has_column('country_stats', 'updated_at');
SELECT has_column('country_stats', 'disease');
SELECT has_column('country_stats', 'country_code');
SELECT has_column('country_stats', 'country_name');
SELECT has_column('country_stats', 'cases');
SELECT has_column('country_stats', 'deaths');
SELECT has_column('country_stats', 'status');

SELECT col_not_null('country_stats', 'country_code');
SELECT col_not_null('country_stats', 'country_name');
SELECT col_not_null('country_stats', 'cases');
SELECT col_not_null('country_stats', 'deaths');

SELECT col_has_check('country_stats', 'status');

-- UNIQUE on (disease, country_code)
SELECT lives_ok(
  $$INSERT INTO country_stats (disease, country_code, country_name) VALUES ('hantavirus','XX','Test')$$,
  'first insert ok'
);
SELECT throws_ok(
  $$INSERT INTO country_stats (disease, country_code, country_name) VALUES ('hantavirus','XX','Test')$$,
  '23505',
  NULL,
  'second insert with same (disease, country_code) is rejected'
);

SELECT has_index('country_stats', 'idx_country_stats_country');
SELECT has_index('country_stats', 'idx_country_stats_disease');

SELECT * FROM finish();
ROLLBACK;
