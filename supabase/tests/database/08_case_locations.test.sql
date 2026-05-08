BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO extensions, public;

SELECT plan(21);

-- Existence
SELECT has_table('case_locations');

-- Required columns
SELECT has_column('case_locations', 'id');
SELECT has_column('case_locations', 'case_id');
SELECT has_column('case_locations', 'country_code');
SELECT has_column('case_locations', 'region');
SELECT has_column('case_locations', 'location_name');
SELECT has_column('case_locations', 'latitude');
SELECT has_column('case_locations', 'longitude');
SELECT has_column('case_locations', 'arrived_at');
SELECT has_column('case_locations', 'departed_at');
SELECT has_column('case_locations', 'context');
SELECT has_column('case_locations', 'is_exposure_site');

-- NOT NULL where required
SELECT col_not_null('case_locations', 'case_id');
SELECT col_not_null('case_locations', 'country_code');
SELECT col_not_null('case_locations', 'arrived_at');
SELECT col_not_null('case_locations', 'is_exposure_site');

-- Primary key
SELECT col_is_pk('case_locations', 'id');

-- ON DELETE CASCADE: insert case + 2 locations, delete case, expect 0 locations
WITH c AS (
  INSERT INTO cases (case_code, status) VALUES ('CASCADE-TEST-001', 'suspected') RETURNING id
)
INSERT INTO case_locations (case_id, country_code, arrived_at)
SELECT c.id, 'XX', now() FROM c
UNION ALL
SELECT c.id, 'YY', now() FROM c;

SELECT cmp_ok(
  (SELECT count(*)::int FROM case_locations
    WHERE case_id = (SELECT id FROM cases WHERE case_code = 'CASCADE-TEST-001')),
  '=', 2,
  'two case_locations rows inserted'
);

DELETE FROM cases WHERE case_code = 'CASCADE-TEST-001';

SELECT cmp_ok(
  (SELECT count(*)::int FROM case_locations WHERE country_code IN ('XX', 'YY')),
  '=', 0,
  'cascade delete removed case_locations rows'
);

-- Indexes
SELECT has_index('case_locations', 'idx_case_locations_case');
SELECT has_index('case_locations', 'idx_case_locations_country');

SELECT * FROM finish();
ROLLBACK;
