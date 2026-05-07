BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO extensions, public;

SELECT plan(33);

-- Existence
SELECT has_table('events');

-- Required columns (every column in the spec)
SELECT has_column('events', 'id');
SELECT has_column('events', 'created_at');
SELECT has_column('events', 'occurred_at');
SELECT has_column('events', 'title');
SELECT has_column('events', 'summary');
SELECT has_column('events', 'raw_content');
SELECT has_column('events', 'source_type');
SELECT has_column('events', 'source_url');
SELECT has_column('events', 'source_url_hash');
SELECT has_column('events', 'source_author');
SELECT has_column('events', 'significance');
SELECT has_column('events', 'category');
SELECT has_column('events', 'country_code');
SELECT has_column('events', 'region');
SELECT has_column('events', 'location_name');
SELECT has_column('events', 'latitude');
SELECT has_column('events', 'longitude');
SELECT has_column('events', 'case_count');
SELECT has_column('events', 'death_count');
SELECT has_column('events', 'is_verified');
SELECT has_column('events', 'tags');
SELECT has_column('events', 'duplicate_of');
SELECT has_column('events', 'disease');

-- NOT NULL where the spec says so
SELECT col_not_null('events', 'created_at');
SELECT col_not_null('events', 'title');
SELECT col_not_null('events', 'summary');
SELECT col_not_null('events', 'source_type');
SELECT col_not_null('events', 'significance');
SELECT col_not_null('events', 'category');
SELECT col_not_null('events', 'is_verified');
SELECT col_not_null('events', 'disease');

-- Primary key
SELECT col_is_pk('events', 'id');

SELECT * FROM finish();
ROLLBACK;
