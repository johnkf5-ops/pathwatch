BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO extensions, public;

SELECT plan(36);

-- Existence
SELECT has_table('facts');

-- Required columns
SELECT has_column('facts', 'id');
SELECT has_column('facts', 'created_at');
SELECT has_column('facts', 'updated_at');
SELECT has_column('facts', 'disease');
SELECT has_column('facts', 'category');
SELECT has_column('facts', 'title');
SELECT has_column('facts', 'content');
SELECT has_column('facts', 'verification_status');
SELECT has_column('facts', 'confidence');
SELECT has_column('facts', 'sources');
SELECT has_column('facts', 'source_types');
SELECT has_column('facts', 'first_reported_at');
SELECT has_column('facts', 'last_verified_at');
SELECT has_column('facts', 'superseded_by');
SELECT has_column('facts', 'tags');

-- NOT NULL where required
SELECT col_not_null('facts', 'created_at');
SELECT col_not_null('facts', 'updated_at');
SELECT col_not_null('facts', 'disease');
SELECT col_not_null('facts', 'category');
SELECT col_not_null('facts', 'title');
SELECT col_not_null('facts', 'content');
SELECT col_not_null('facts', 'verification_status');
SELECT col_not_null('facts', 'sources');

SELECT col_is_pk('facts', 'id');

-- CHECK constraints
SELECT col_has_check('facts', 'category');
SELECT col_has_check('facts', 'verification_status');
SELECT col_has_check('facts', 'confidence');

-- Reject bad values
SELECT throws_ok(
  $$INSERT INTO facts (category, title, content, verification_status, sources)
    VALUES ('astrology','x','y','confirmed', ARRAY['http://x.test'])$$,
  '23514', NULL, 'rejects unknown category'
);
SELECT throws_ok(
  $$INSERT INTO facts (category, title, content, verification_status, sources, confidence)
    VALUES ('pathogen','x','y','confirmed', ARRAY['http://x.test'], 1.5)$$,
  '23514', NULL, 'rejects confidence > 1'
);

-- UNIQUE on (disease, title)
SELECT lives_ok(
  $$INSERT INTO facts (category, title, content, verification_status, sources)
    VALUES ('pathogen','UNIQUE-TEST','y','confirmed', ARRAY['http://x.test'])$$,
  'first insert ok'
);
SELECT throws_ok(
  $$INSERT INTO facts (category, title, content, verification_status, sources)
    VALUES ('pathogen','UNIQUE-TEST','z','confirmed', ARRAY['http://x.test'])$$,
  '23505', NULL, 'rejects duplicate (disease, title)'
);

-- Indexes
SELECT has_index('facts', 'idx_facts_disease');
SELECT has_index('facts', 'idx_facts_category');
SELECT has_index('facts', 'idx_facts_verification');
SELECT has_index('facts', 'idx_facts_tags');

SELECT * FROM finish();
ROLLBACK;
