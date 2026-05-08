BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO extensions, public;

SELECT plan(41);

-- Existence
SELECT has_table('cases');

-- Required columns
SELECT has_column('cases', 'id');
SELECT has_column('cases', 'created_at');
SELECT has_column('cases', 'updated_at');
SELECT has_column('cases', 'case_code');
SELECT has_column('cases', 'disease');
SELECT has_column('cases', 'status');
SELECT has_column('cases', 'is_index_case');
SELECT has_column('cases', 'role');
SELECT has_column('cases', 'exposure_type');
SELECT has_column('cases', 'age_range');
SELECT has_column('cases', 'sex');
SELECT has_column('cases', 'exposure_country');
SELECT has_column('cases', 'exposure_date');
SELECT has_column('cases', 'onset_date');
SELECT has_column('cases', 'confirmed_date');
SELECT has_column('cases', 'outcome_date');
SELECT has_column('cases', 'current_country');
SELECT has_column('cases', 'dossier');
SELECT has_column('cases', 'notes');
SELECT has_column('cases', 'source_event_id');
SELECT has_column('cases', 'clearance_date');

-- NOT NULL where required
SELECT col_not_null('cases', 'created_at');
SELECT col_not_null('cases', 'updated_at');
SELECT col_not_null('cases', 'case_code');
SELECT col_not_null('cases', 'disease');
SELECT col_not_null('cases', 'status');
SELECT col_not_null('cases', 'is_index_case');

-- Primary key
SELECT col_is_pk('cases', 'id');

-- UNIQUE on case_code
SELECT col_is_unique('cases', 'case_code');

-- CHECK constraints
SELECT col_has_check('cases', 'status');
SELECT col_has_check('cases', 'role');
SELECT col_has_check('cases', 'exposure_type');
SELECT col_has_check('cases', 'sex');

-- Reject bad enum values
SELECT throws_ok(
  $$INSERT INTO cases (case_code, status) VALUES ('TEST-001', 'unknown')$$,
  '23514',
  NULL,
  'rejects unknown status'
);
SELECT throws_ok(
  $$INSERT INTO cases (case_code, status, role) VALUES ('TEST-002', 'confirmed', 'wizard')$$,
  '23514',
  NULL,
  'rejects unknown role'
);
SELECT lives_ok(
  $$INSERT INTO cases (case_code, status, clearance_date) VALUES ('TEST-MON', 'monitoring', '2026-06-19')$$,
  'accepts monitoring status with clearance_date'
);

-- Indexes
SELECT has_index('cases', 'idx_cases_disease');
SELECT has_index('cases', 'idx_cases_status');
SELECT has_index('cases', 'idx_cases_current_country');
SELECT has_index('cases', 'idx_cases_index');

SELECT * FROM finish();
ROLLBACK;
