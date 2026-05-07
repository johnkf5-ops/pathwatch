BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO extensions, public;

SELECT plan(1);

SELECT ok(true, 'pgTAP harness works');

SELECT * FROM finish();
ROLLBACK;
