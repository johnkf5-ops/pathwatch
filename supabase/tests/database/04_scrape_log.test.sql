BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO extensions, public;

SELECT plan(13);

SELECT has_table('scrape_log');

SELECT has_column('scrape_log', 'id');
SELECT has_column('scrape_log', 'created_at');
SELECT has_column('scrape_log', 'source_type');
SELECT has_column('scrape_log', 'query');
SELECT has_column('scrape_log', 'results_found');
SELECT has_column('scrape_log', 'events_created');
SELECT has_column('scrape_log', 'duplicates_skipped');
SELECT has_column('scrape_log', 'error');
SELECT has_column('scrape_log', 'duration_ms');

SELECT col_not_null('scrape_log', 'source_type');

SELECT has_index('scrape_log', 'idx_scrape_log_created_at');
SELECT has_index('scrape_log', 'idx_scrape_log_source_type');

SELECT * FROM finish();
ROLLBACK;
