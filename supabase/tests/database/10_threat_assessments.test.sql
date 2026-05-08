BEGIN;
SELECT plan(19);

-- table exists
SELECT has_table('public', 'threat_assessments', 'threat_assessments table exists');

-- required columns
SELECT has_column('public', 'threat_assessments', 'id', 'has id');
SELECT has_column('public', 'threat_assessments', 'created_at', 'has created_at');
SELECT has_column('public', 'threat_assessments', 'disease', 'has disease');
SELECT has_column('public', 'threat_assessments', 'model', 'has model');
SELECT has_column('public', 'threat_assessments', 'pipeline_session_id', 'has pipeline_session_id');
SELECT has_column('public', 'threat_assessments', 'pandemic_probability', 'has pandemic_probability');
SELECT has_column('public', 'threat_assessments', 'threat_level', 'has threat_level');
SELECT has_column('public', 'threat_assessments', 'summary', 'has summary');
SELECT has_column('public', 'threat_assessments', 'reasoning', 'has reasoning');
SELECT has_column('public', 'threat_assessments', 'triggers_watching', 'has triggers_watching');
SELECT has_column('public', 'threat_assessments', 'triggers_tripped', 'has triggers_tripped');

-- check constraints
SELECT col_has_check('public', 'threat_assessments', 'pandemic_probability', 'pandemic_probability has CHECK');
SELECT col_has_check('public', 'threat_assessments', 'threat_level', 'threat_level has CHECK');

-- threat_level CHECK rejects bad value
PREPARE bad_level AS INSERT INTO threat_assessments (model, pandemic_probability, threat_level, summary, reasoning)
  VALUES ('test', 0.5, 'bogus', 's', 'r');
SELECT throws_ok('bad_level', '23514', NULL, 'rejects unknown threat_level');

-- pandemic_probability CHECK rejects out-of-range
PREPARE bad_prob AS INSERT INTO threat_assessments (model, pandemic_probability, threat_level, summary, reasoning)
  VALUES ('test', 1.5, 'low', 's', 'r');
SELECT throws_ok('bad_prob', '23514', NULL, 'rejects pandemic_probability > 1');

-- RLS enabled
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'threat_assessments'),
  true,
  'RLS enabled on threat_assessments'
);

-- public read policy exists
SELECT policies_are('public', 'threat_assessments', ARRAY['threat_public_read'], 'public read policy in place');

-- realtime publication includes threat_assessments
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'threat_assessments'
  ),
  'threat_assessments is in supabase_realtime publication'
);

SELECT * FROM finish();
ROLLBACK;
