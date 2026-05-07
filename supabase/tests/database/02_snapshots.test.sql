BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO extensions, public;

SELECT plan(20);

SELECT has_table('snapshots');

SELECT has_column('snapshots', 'id');
SELECT has_column('snapshots', 'created_at');
SELECT has_column('snapshots', 'disease');
SELECT has_column('snapshots', 'total_cases');
SELECT has_column('snapshots', 'total_deaths');
SELECT has_column('snapshots', 'countries_affected');
SELECT has_column('snapshots', 'countries_list');
SELECT has_column('snapshots', 'fatality_rate');
SELECT has_column('snapshots', 'trend');
SELECT has_column('snapshots', 'trend_description');
SELECT has_column('snapshots', 'risk_level');
SELECT has_column('snapshots', 'key_developments');
SELECT has_column('snapshots', 'ai_analysis');

SELECT col_not_null('snapshots', 'created_at');
SELECT col_not_null('snapshots', 'disease');
SELECT col_is_pk('snapshots', 'id');

SELECT col_has_check('snapshots', 'trend');
SELECT col_has_check('snapshots', 'risk_level');

SELECT has_index('snapshots', 'idx_snapshots_created_at');

SELECT * FROM finish();
ROLLBACK;
