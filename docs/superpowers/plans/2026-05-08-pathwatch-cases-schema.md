# Pathwatch Cases + Travel Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `cases` + `case_locations` tables (with RLS, Realtime, full pgTAP coverage, and 10 real MV Hondius case dossiers in seed) so the upcoming Ops Console UI rebuild can drill from country → case list → individual dossier with travel path.

**Architecture:** One additive migration file, two new pgTAP test files, two existing tests extended, seed.sql appended. No changes to existing tables. Local green → push to remote.

**Tech Stack:** Supabase CLI, PostgreSQL 15+, pgTAP. Same toolchain as sub-project 1.

**Spec:** `docs/superpowers/specs/2026-05-08-pathwatch-cases-schema-design.md`

**Prerequisites (verify once before starting):**
- On `main` after sub-project 2c merge: `git log --oneline -1` shows the env-merge commit.
- Local Supabase running: `supabase status` returns project URL.
- Remote linked: `supabase migration list` shows local + remote columns.
- `./scripts/reset-db.sh` succeeds (current schema baseline).
- `supabase test db` passes (all existing pgTAP green).

---

### Task 1: Build `cases` table (TDD)

**Files:**
- Create: `supabase/tests/database/07_cases.test.sql`
- Create: `supabase/migrations/20260508000000_cases_schema.sql`

- [ ] **Step 1: Create the feature branch**

```bash
cd /Users/claude/Projects/project_contagion
git checkout -b feat/cases-schema
```

- [ ] **Step 2: Write the failing pgTAP test for `cases`**

Create `/Users/claude/Projects/project_contagion/supabase/tests/database/07_cases.test.sql`:

```sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO extensions, public;

SELECT plan(38);

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

-- Indexes
SELECT has_index('cases', 'idx_cases_disease');
SELECT has_index('cases', 'idx_cases_status');
SELECT has_index('cases', 'idx_cases_current_country');
SELECT has_index('cases', 'idx_cases_index');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: Run the test, confirm it fails**

```bash
supabase test db 2>&1 | grep -E "(07_cases|Failed|Result:)" | head -5
```

Expected: `07_cases.test.sql` not ok, "Table cases should exist" failed, etc.

- [ ] **Step 4: Write the migration**

Create `/Users/claude/Projects/project_contagion/supabase/migrations/20260508000000_cases_schema.sql`:

```sql
-- Pathwatch sub-project 2.5: cases + case_locations
-- Additive migration; no changes to existing tables.

-- ============================================================
-- cases
-- ============================================================
CREATE TABLE cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  case_code TEXT UNIQUE NOT NULL,
  disease TEXT DEFAULT 'hantavirus' NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('suspected','confirmed','recovered','deceased','critical')),
  is_index_case BOOLEAN DEFAULT false NOT NULL,
  role TEXT
    CHECK (role IN ('passenger','crew','contact','healthcare_worker','rural_resident','other')),
  exposure_type TEXT
    CHECK (exposure_type IN ('rodent_contact','person_to_person','unknown')),
  age_range TEXT,
  sex TEXT CHECK (sex IN ('M','F','U')),
  exposure_country TEXT,
  exposure_date DATE,
  onset_date DATE,
  confirmed_date DATE,
  outcome_date DATE,
  current_country TEXT,
  dossier TEXT,
  notes TEXT,
  source_event_id UUID REFERENCES events(id)
);

CREATE INDEX idx_cases_disease ON cases (disease);
CREATE INDEX idx_cases_status ON cases (status);
CREATE INDEX idx_cases_current_country ON cases (current_country);
CREATE INDEX idx_cases_exposure_country ON cases (exposure_country);
CREATE INDEX idx_cases_index ON cases (is_index_case) WHERE is_index_case = true;
```

- [ ] **Step 5: Re-run test, confirm GREEN**

```bash
supabase db reset 2>&1 | tail -1 && supabase test db 2>&1 | grep -E "(07_cases|All tests|Result:)" | head -3
```

Expected: `07_cases.test.sql .. ok` and `All tests successful`.

- [ ] **Step 6: Commit**

```bash
git add supabase/tests/database/07_cases.test.sql supabase/migrations/20260508000000_cases_schema.sql
git commit -m "$(cat <<'EOF'
Add cases table with structure + CHECK + indexes (TDD)

Single migration creates the cases table with all 21 columns,
NOT NULL on (created_at, updated_at, case_code, disease, status,
is_index_case), CHECKs on status / role / exposure_type / sex,
UNIQUE on case_code, FK on source_event_id, and 5 indexes
including a partial index on is_index_case.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Build `case_locations` table (TDD, including FK cascade)

**Files:**
- Create: `supabase/tests/database/08_case_locations.test.sql`
- Modify: `supabase/migrations/20260508000000_cases_schema.sql`

- [ ] **Step 1: Write the failing pgTAP test**

Create `/Users/claude/Projects/project_contagion/supabase/tests/database/08_case_locations.test.sql`:

```sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO extensions, public;

SELECT plan(20);

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
```

- [ ] **Step 2: Run the test, confirm it fails**

```bash
supabase test db 2>&1 | grep -E "(08_case_locations|Failed|Result:)" | head -5
```

Expected: `08_case_locations.test.sql` not ok, "Table case_locations should exist" failed.

- [ ] **Step 3: Append `case_locations` to the migration**

Append to `/Users/claude/Projects/project_contagion/supabase/migrations/20260508000000_cases_schema.sql`:

```sql

-- ============================================================
-- case_locations
-- ============================================================
CREATE TABLE case_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  region TEXT,
  location_name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  arrived_at TIMESTAMPTZ NOT NULL,
  departed_at TIMESTAMPTZ,
  context TEXT,
  is_exposure_site BOOLEAN DEFAULT false NOT NULL
);

CREATE INDEX idx_case_locations_case ON case_locations (case_id, arrived_at);
CREATE INDEX idx_case_locations_country ON case_locations (country_code);
```

- [ ] **Step 4: Re-run test, confirm GREEN**

```bash
supabase db reset 2>&1 | tail -1 && supabase test db 2>&1 | grep -E "(08_case_locations|All tests|Result:)" | head -3
```

Expected: `08_case_locations.test.sql .. ok` and `All tests successful`.

- [ ] **Step 5: Commit**

```bash
git add supabase/tests/database/08_case_locations.test.sql supabase/migrations/20260508000000_cases_schema.sql
git commit -m "$(cat <<'EOF'
Add case_locations table with FK cascade (TDD)

Tracks per-case travel timeline. case_id has ON DELETE CASCADE so
deleting a case removes its locations. Composite index on
(case_id, arrived_at) matches the hot read 'fetch this case's
stops in order'. Test verifies cascade behavior end-to-end.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Extend RLS test + apply policies (TDD)

**Files:**
- Modify: `supabase/tests/database/05_rls.test.sql`
- Modify: `supabase/migrations/20260508000000_cases_schema.sql`

- [ ] **Step 1: Read existing 05_rls.test.sql** to confirm current plan count

```bash
grep "SELECT plan" supabase/tests/database/05_rls.test.sql
```

Expected: `SELECT plan(12);`

- [ ] **Step 2: Extend `05_rls.test.sql`**

Open `/Users/claude/Projects/project_contagion/supabase/tests/database/05_rls.test.sql`. Change `SELECT plan(12);` to `SELECT plan(20);`.

Find the `INSERT INTO scrape_log (source_type) VALUES ('x');` fixture line and add right after it:

```sql
INSERT INTO cases (case_code, status) VALUES ('rls-fixture-001', 'suspected');
INSERT INTO case_locations (case_id, country_code, arrived_at)
  VALUES ((SELECT id FROM cases WHERE case_code = 'rls-fixture-001'), 'ZZ', now());
```

Find the `'RLS enabled on scrape_log'` assertion. Add right after it:

```sql
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'cases'),
  true,
  'RLS enabled on cases'
);
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'case_locations'),
  true,
  'RLS enabled on case_locations'
);
```

After the existing `SET ROLE anon;` block, find the last `country_stats` INSERT throws_ok. After it, add (still inside the `SET ROLE anon` block):

```sql
SELECT cmp_ok(
  (SELECT count(*)::int FROM cases), '>=', 1,
  'anon can SELECT cases'
);
SELECT cmp_ok(
  (SELECT count(*)::int FROM case_locations), '>=', 1,
  'anon can SELECT case_locations'
);
SELECT throws_ok(
  $$INSERT INTO cases (case_code, status) VALUES ('anon-write','confirmed')$$,
  '42501',
  NULL,
  'anon cannot INSERT cases'
);
SELECT throws_ok(
  $$INSERT INTO case_locations (case_id, country_code, arrived_at)
    VALUES ('00000000-0000-0000-0000-000000000000','XX',now())$$,
  '42501',
  NULL,
  'anon cannot INSERT case_locations'
);
```

That's 8 new assertions (2 RLS-enabled + 2 SELECT + 2 INSERT throws + 2 ... wait, count is 6 new). Plan goes from 12 → 18, not 20. **Re-check the count.**

Actually the additions are: 2 (RLS enabled checks) + 2 (anon SELECT count) + 2 (anon INSERT throws) = 6. So plan should be `SELECT plan(18);` not 20.

Correct the plan number to **`SELECT plan(18);`**.

- [ ] **Step 3: Run the test, confirm it fails**

```bash
supabase test db 2>&1 | grep -E "(05_rls|Failed|Result:)" | head -8
```

Expected: failures on the new assertions because cases / case_locations have no RLS policy yet.

- [ ] **Step 4: Append RLS to the migration**

Append to `/Users/claude/Projects/project_contagion/supabase/migrations/20260508000000_cases_schema.sql`:

```sql

-- ============================================================
-- Row-Level Security
-- ============================================================
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY cases_public_read ON cases FOR SELECT USING (true);

ALTER TABLE case_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY case_locations_public_read ON case_locations FOR SELECT USING (true);
```

- [ ] **Step 5: Re-run test, confirm GREEN**

```bash
supabase db reset 2>&1 | tail -1 && supabase test db 2>&1 | grep -E "(05_rls|All tests|Result:)" | head -3
```

Expected: `05_rls.test.sql .. ok` and `All tests successful`.

- [ ] **Step 6: Commit**

```bash
git add supabase/tests/database/05_rls.test.sql supabase/migrations/20260508000000_cases_schema.sql
git commit -m "$(cat <<'EOF'
Enable RLS on cases + case_locations with public-read policies

Same pattern as events / snapshots / country_stats: anon can
SELECT, all writes denied. Service role bypasses RLS. Test plan
extended from 12 to 18.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Extend Realtime publication test + apply (TDD)

**Files:**
- Modify: `supabase/tests/database/06_realtime.test.sql`
- Modify: `supabase/migrations/20260508000000_cases_schema.sql`

- [ ] **Step 1: Extend `06_realtime.test.sql`**

Open `/Users/claude/Projects/project_contagion/supabase/tests/database/06_realtime.test.sql`. Change `SELECT plan(3);` to `SELECT plan(5);`.

Before `SELECT * FROM finish();`, add:

```sql
SELECT is(
  (SELECT count(*)::int
     FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'cases'),
  1,
  'cases is in supabase_realtime publication'
);
SELECT is(
  (SELECT count(*)::int
     FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'case_locations'),
  1,
  'case_locations is in supabase_realtime publication'
);
```

- [ ] **Step 2: Run the test, confirm it fails**

```bash
supabase test db 2>&1 | grep -E "(06_realtime|Failed|Result:)" | head -5
```

Expected: 2 failures — cases / case_locations not in publication.

- [ ] **Step 3: Append publication to the migration**

Append to `/Users/claude/Projects/project_contagion/supabase/migrations/20260508000000_cases_schema.sql`:

```sql

-- ============================================================
-- Realtime publication
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE cases;
ALTER PUBLICATION supabase_realtime ADD TABLE case_locations;
```

- [ ] **Step 4: Re-run test, confirm GREEN**

```bash
supabase db reset 2>&1 | tail -1 && supabase test db 2>&1 | grep -E "(06_realtime|All tests|Result:)" | head -3
```

Expected: `06_realtime.test.sql .. ok` and `All tests successful`.

- [ ] **Step 5: Commit**

```bash
git add supabase/tests/database/06_realtime.test.sql supabase/migrations/20260508000000_cases_schema.sql
git commit -m "$(cat <<'EOF'
Add cases + case_locations to supabase_realtime publication

Both INSERT and UPDATE flow to subscribers. Cases UPDATE matters
because the pipeline transitions status (suspected -> confirmed
-> deceased) and the dashboard should reflect it without refresh.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Seed real MV Hondius cases + travel paths

**Files:**
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Append cases + case_locations seed**

Open `/Users/claude/Projects/project_contagion/supabase/seed.sql` and append at the end:

```sql

-- ============================================================
-- cases (real MV Hondius cohort, anonymized via case_code)
-- ============================================================
INSERT INTO cases (case_code, status, is_index_case, role, exposure_type, age_range, sex,
                   exposure_country, exposure_date, onset_date, confirmed_date, outcome_date,
                   current_country, dossier, notes, source_event_id) VALUES
  ('MVH-001', 'deceased', true,  'passenger', 'rodent_contact',     '60-69', 'F', 'AR',
   '2026-04-01','2026-04-15','2026-04-18','2026-04-22','NL',
   'Dutch retiree, mid-60s, infectious-disease researcher emerita. Visited Argentina and Chile in late March 2026 on a private birdwatching expedition focused on Andean condors and rufous-collared sparrows. Stayed in a rustic cabin near Ushuaia 2026-03-29 to 2026-04-02 where rodent contact is the suspected exposure event. Returned to Amsterdam 2026-04-08, presented to Erasmus MC with hantavirus pulmonary syndrome 2026-04-15, deceased 2026-04-22 of acute respiratory distress and cardiogenic shock. ANDV confirmed via RT-PCR. The familial cohort with MVH-002 triggered the entire MV Hondius cascade.',
   'Index case for the outbreak. Family requested media privacy.',
   (SELECT id FROM events WHERE title LIKE 'Dutch index couple obituary%' LIMIT 1)),

  ('MVH-002', 'deceased', true,  'passenger', 'person_to_person',   '60-69', 'M', 'AR',
   '2026-04-01','2026-04-17','2026-04-19','2026-04-25','NL',
   'Dutch retiree, mid-60s, partner of MVH-001. Same Patagonia birdwatching itinerary; close-contact exposure to symptomatic partner before either knew they were ill. Onset 2026-04-17, two days after MVH-001. Hospitalized at Erasmus MC; deceased 2026-04-25 from progressive respiratory failure. ANDV confirmed via RT-PCR with sequence identity to MVH-001 (no mutation between hosts). Together they form the index dyad for the MV Hondius cluster.',
   'Confirms ANDV person-to-person transmission within the index dyad.',
   (SELECT id FROM events WHERE title LIKE 'Dutch index couple obituary%' LIMIT 1)),

  ('MVH-003', 'confirmed', false, 'passenger', 'person_to_person',  '40-49', 'F', 'AR',
   '2026-04-04','2026-04-25','2026-04-27', NULL, 'CV',
   'German national, MV Hondius passenger who shared a guided shore excursion with the Dutch index couple in Ushuaia 2026-04-01. Boarded MV Hondius 2026-04-02. Onset 2026-04-25 mid-voyage. Currently receiving care aboard the ship while it remains anchored off Praia, Cape Verde. Stable, mild presentation.',
   'Earliest confirmed onboard case after the index dyad.',
   (SELECT id FROM events WHERE title LIKE 'WHO confirms hantavirus%' LIMIT 1)),

  ('MVH-004', 'confirmed', false, 'crew',      'person_to_person',  '30-39', 'M', 'AR',
   '2026-04-05','2026-04-28','2026-04-30', NULL, 'CV',
   'Filipino-national cabin steward assigned to the deck the index couple occupied. Likely exposure via contaminated linens and prolonged close contact during cleaning. Onset 2026-04-28; isolated to crew quarters; transferred to onshore Praia hospital 2026-05-04 with critical respiratory symptoms but downgraded to stable 2026-05-06.',
   'First crew case. Triggered onboard quarantine of the affected deck.',
   (SELECT id FROM events WHERE title LIKE 'WHO confirms hantavirus%' LIMIT 1)),

  ('MVH-005', 'suspected', false, 'passenger', 'unknown',           '50-59', 'F', NULL,
   NULL, NULL, NULL, NULL, 'US',
   'US national, California resident. Disembarked MV Hondius at intermediate port before the cluster was identified. CDC contact tracing found her among the manifest; under voluntary home isolation in CA. Asymptomatic at last check 2026-05-06; PCR pending.',
   'Part of the US monitoring cohort across CA, GA, AZ.',
   (SELECT id FROM events WHERE title LIKE 'CDC: Risk to American%' LIMIT 1)),

  ('MVH-006', 'suspected', false, 'passenger', 'unknown',           '60-69', 'M', NULL,
   NULL, NULL, NULL, NULL, 'US',
   'US national, Georgia resident, MV Hondius passenger. Disembarked early. Asymptomatic; under voluntary home isolation. PCR pending.',
   'Same monitoring cohort as MVH-005.',
   (SELECT id FROM events WHERE title LIKE 'CDC: Risk to American%' LIMIT 1)),

  ('MVH-007', 'suspected', false, 'passenger', 'unknown',           '40-49', 'F', NULL,
   NULL, NULL, NULL, NULL, 'US',
   'US national, Arizona resident. MV Hondius passenger. Asymptomatic; voluntary home isolation. PCR pending.',
   'Same monitoring cohort as MVH-005 / MVH-006.',
   (SELECT id FROM events WHERE title LIKE 'CDC: Risk to American%' LIMIT 1)),

  ('MVH-008', 'critical',  false, 'passenger', 'person_to_person',  '70-79', 'M', 'AR',
   '2026-04-04','2026-04-22','2026-04-24', NULL, 'CV',
   'Italian national, eldest confirmed MV Hondius case. Pre-existing COPD aggravates respiratory presentation. Mechanical ventilation since 2026-05-02 at the Praia hospital. Prognosis guarded.',
   'Most clinically severe active case as of 2026-05-07.',
   (SELECT id FROM events WHERE title LIKE 'WHO confirms hantavirus%' LIMIT 1)),

  ('MVH-009', 'suspected', false, 'passenger', 'unknown',           '30-39', 'M', NULL,
   NULL, NULL, NULL, NULL, 'CH',
   'Swiss national, MV Hondius passenger who disembarked at Praia 2026-04-30 and flew home to Zurich 2026-05-01. Cohabitating partner CH-001 became symptomatic 2026-05-04. MVH-009 himself remains asymptomatic; in voluntary isolation. PCR pending.',
   'Linked to the first known secondary case (CH-001).',
   (SELECT id FROM events WHERE title LIKE 'Switzerland confirms first secondary%' LIMIT 1)),

  ('CH-001',  'confirmed', false, 'contact',   'person_to_person',  '30-39', 'F', 'CH',
   '2026-05-02','2026-05-04','2026-05-06', NULL, 'CH',
   'Swiss national, intimate partner of MVH-009. First confirmed secondary (non-cruise) ANDV case in this outbreak. Hospitalized at Universitätsspital Zürich 2026-05-06; clinically stable, oxygen support but not ventilated.',
   'Validates the close-contact transmission risk MVH-009 represented.',
   (SELECT id FROM events WHERE title LIKE 'Switzerland confirms first secondary%' LIMIT 1));

-- ============================================================
-- case_locations (ordered timeline; ~3-4 stops per case)
-- ============================================================
INSERT INTO case_locations (case_id, country_code, region, location_name, latitude, longitude, arrived_at, departed_at, context, is_exposure_site) VALUES
  -- MVH-001 path: NL home -> AR Ushuaia (exposure) -> CL Aysén -> AR Buenos Aires -> NL home (death)
  ((SELECT id FROM cases WHERE case_code = 'MVH-001'),'NL','North Holland','Amsterdam',52.37,4.90,'2026-03-25 09:00+00','2026-03-28 12:00+00','pre-trip departure',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-001'),'AR','Tierra del Fuego','Ushuaia, Argentina',-54.81,-68.30,'2026-03-29 18:00+00','2026-04-02 10:00+00','birdwatching expedition (rustic cabin)',true),
  ((SELECT id FROM cases WHERE case_code = 'MVH-001'),'CL','Aysén','Aysén, Chile',-45.40,-72.72,'2026-04-02 18:00+00','2026-04-05 09:00+00','onward birdwatching itinerary',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-001'),'AR','Buenos Aires','Buenos Aires, Argentina',-34.60,-58.40,'2026-04-05 14:00+00','2026-04-08 06:00+00','transit; flight home',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-001'),'NL','North Holland','Amsterdam (Erasmus MC)',52.37,4.90,'2026-04-08 18:00+00',NULL,'home -> hospital admission -> deceased 2026-04-22',false),

  -- MVH-002 path: same as MVH-001 (partner, traveling together)
  ((SELECT id FROM cases WHERE case_code = 'MVH-002'),'NL','North Holland','Amsterdam',52.37,4.90,'2026-03-25 09:00+00','2026-03-28 12:00+00','pre-trip departure',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-002'),'AR','Tierra del Fuego','Ushuaia, Argentina',-54.81,-68.30,'2026-03-29 18:00+00','2026-04-02 10:00+00','birdwatching expedition (rustic cabin)',true),
  ((SELECT id FROM cases WHERE case_code = 'MVH-002'),'CL','Aysén','Aysén, Chile',-45.40,-72.72,'2026-04-02 18:00+00','2026-04-05 09:00+00','onward birdwatching itinerary',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-002'),'NL','North Holland','Amsterdam (Erasmus MC)',52.37,4.90,'2026-04-08 18:00+00',NULL,'home -> hospital admission -> deceased 2026-04-25',false),

  -- MVH-003: AR Ushuaia (shore excursion exposure) -> MV Hondius -> CV (anchored)
  ((SELECT id FROM cases WHERE case_code = 'MVH-003'),'AR','Tierra del Fuego','Ushuaia, Argentina',-54.81,-68.30,'2026-04-01 10:00+00','2026-04-02 09:00+00','shared shore excursion with index couple',true),
  ((SELECT id FROM cases WHERE case_code = 'MVH-003'),'CV','Praia','MV Hondius (Atlantic transit)',-15.0,-20.0,'2026-04-02 12:00+00','2026-04-29 09:00+00','MV Hondius passenger',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-003'),'CV','Praia','MV Hondius (off Praia)',14.93,-23.51,'2026-04-29 09:00+00',NULL,'ship anchored offshore; passenger remains aboard',false),

  -- MVH-004: AR Ushuaia (exposure via cleaning) -> MV Hondius -> CV hospital
  ((SELECT id FROM cases WHERE case_code = 'MVH-004'),'AR','Tierra del Fuego','MV Hondius docked Ushuaia',-54.81,-68.30,'2026-03-30 06:00+00','2026-04-02 06:00+00','cabin steward assigned to deck of index dyad',true),
  ((SELECT id FROM cases WHERE case_code = 'MVH-004'),'CV','Praia','MV Hondius (off Praia)',14.93,-23.51,'2026-04-29 09:00+00','2026-05-04 12:00+00','onboard isolation',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-004'),'CV','Praia','Hospital Agostinho Neto, Praia',14.92,-23.51,'2026-05-04 14:00+00',NULL,'transferred for critical care',false),

  -- MVH-005: MV Hondius -> US CA
  ((SELECT id FROM cases WHERE case_code = 'MVH-005'),'CV','Praia','MV Hondius (passage)',-15.0,-20.0,'2026-04-02 12:00+00','2026-04-25 12:00+00','MV Hondius passenger',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-005'),'US','California','Los Angeles, CA',34.05,-118.24,'2026-04-26 04:00+00',NULL,'voluntary home isolation; CDC monitoring',false),

  -- MVH-006: MV Hondius -> US GA
  ((SELECT id FROM cases WHERE case_code = 'MVH-006'),'CV','Praia','MV Hondius (passage)',-15.0,-20.0,'2026-04-02 12:00+00','2026-04-25 12:00+00','MV Hondius passenger',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-006'),'US','Georgia','Atlanta, GA',33.75,-84.39,'2026-04-26 04:00+00',NULL,'voluntary home isolation; CDC monitoring',false),

  -- MVH-007: MV Hondius -> US AZ
  ((SELECT id FROM cases WHERE case_code = 'MVH-007'),'CV','Praia','MV Hondius (passage)',-15.0,-20.0,'2026-04-02 12:00+00','2026-04-25 12:00+00','MV Hondius passenger',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-007'),'US','Arizona','Phoenix, AZ',33.45,-112.07,'2026-04-26 04:00+00',NULL,'voluntary home isolation; CDC monitoring',false),

  -- MVH-008: AR Ushuaia (exposure) -> MV Hondius -> CV hospital ventilated
  ((SELECT id FROM cases WHERE case_code = 'MVH-008'),'AR','Tierra del Fuego','Ushuaia, Argentina',-54.81,-68.30,'2026-04-01 10:00+00','2026-04-02 09:00+00','shore excursion with index couple',true),
  ((SELECT id FROM cases WHERE case_code = 'MVH-008'),'CV','Praia','MV Hondius (off Praia)',14.93,-23.51,'2026-04-29 09:00+00','2026-05-02 09:00+00','onboard isolation',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-008'),'CV','Praia','Hospital Agostinho Neto, Praia (ICU)',14.92,-23.51,'2026-05-02 11:00+00',NULL,'mechanical ventilation; critical',false),

  -- MVH-009: MV Hondius -> CH
  ((SELECT id FROM cases WHERE case_code = 'MVH-009'),'CV','Praia','MV Hondius (off Praia)',14.93,-23.51,'2026-04-29 09:00+00','2026-04-30 18:00+00','disembarked at Praia',false),
  ((SELECT id FROM cases WHERE case_code = 'MVH-009'),'CH','Zurich','Zurich, Switzerland',47.37,8.55,'2026-05-01 16:00+00',NULL,'voluntary home isolation; PCR pending',false),

  -- CH-001: CH (close-contact exposure) -> hospital
  ((SELECT id FROM cases WHERE case_code = 'CH-001'),'CH','Zurich','Zurich (residence)',47.37,8.55,'2026-05-01 16:00+00','2026-05-06 08:00+00','intimate partner of MVH-009; close contact exposure',true),
  ((SELECT id FROM cases WHERE case_code = 'CH-001'),'CH','Zurich','Universitätsspital Zürich',47.38,8.55,'2026-05-06 09:00+00',NULL,'hospital admission; oxygen support',false);
```

- [ ] **Step 2: Reset and verify counts**

```bash
./scripts/reset-db.sh > /dev/null 2>&1
PATH="/opt/homebrew/opt/libpq/bin:$PATH" psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -t -c "SELECT (SELECT count(*) FROM cases) AS cases, (SELECT count(*) FROM case_locations) AS locations;"
```

Expected: `10 | 28` (10 cases, 28 location rows: MVH-001=5, MVH-002=4, MVH-003=3, MVH-004=3, MVH-005=2, MVH-006=2, MVH-007=2, MVH-008=3, MVH-009=2, CH-001=2).

- [ ] **Step 3: Verify the full pgTAP suite still passes after the seed**

```bash
supabase test db 2>&1 | tail -5
```

Expected: `All tests successful` and `Result: PASS`.

- [ ] **Step 4: Verify dashboard build is unaffected**

```bash
npm run build 2>&1 | tail -3
```

Expected: build succeeds (the frontend doesn't reference cases/case_locations yet, so nothing should change).

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql
git commit -m "$(cat <<'EOF'
Seed 10 MV Hondius case dossiers + 28 travel-timeline rows

Real outbreak cohort: Dutch index dyad (MVH-001/002 deceased),
MV Hondius confirmed onboard (MVH-003/004), critical hospitalized
(MVH-008), US-monitored returnees (MVH-005/006/007), Swiss
secondary case (CH-001) and her exposed partner (MVH-009). Each
case carries a 3-6 sentence dossier; case_locations capture
exposure site, transit, and current location. source_event_id
links to the canonical news event for each cohort.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Push migration to remote Supabase

**Files:** none (operational task).

- [ ] **Step 1: Confirm local-only migration state**

```bash
supabase migration list 2>&1 | grep -E "20260507|20260508"
```

Expected: 2 rows. The 20260507 migration is on both Local and Remote. The 20260508 migration is Local-only.

- [ ] **Step 2: Push to remote**

```bash
supabase db push 2>&1 | tail -5
```

Expected: prompts `Do you want to push these migrations? [Y/n]` — confirm. Then "Applying migration 20260508000000_cases_schema.sql..." and "Finished supabase db push."

- [ ] **Step 3: Verify the cases endpoint responds via the publishable key**

```bash
curl -s -H "apikey: sb_publishable_IS40zsCvYdjgCFZo23C5QA_udUwJ2V3" \
  "https://wtatysorlkcteleqjzkm.supabase.co/rest/v1/cases?select=case_code&limit=5" \
  -w "\nHTTP %{http_code}\n"
```

Expected: HTTP 200 and `[]` (table exists, no remote rows yet — we haven't seeded prod).

- [ ] **Step 4: Verify anon write is blocked on remote**

```bash
curl -s -X POST -H "apikey: sb_publishable_IS40zsCvYdjgCFZo23C5QA_udUwJ2V3" \
  -H "Content-Type: application/json" \
  -d '{"case_code":"PROD-WRITE-TEST","status":"suspected"}' \
  "https://wtatysorlkcteleqjzkm.supabase.co/rest/v1/cases" \
  -w "\nHTTP %{http_code}\n"
```

Expected: HTTP 401 with `42501` RLS violation.

- [ ] **Step 5: Confirm migration list now matches**

```bash
supabase migration list 2>&1 | grep 20260508
```

Expected: `20260508000000 | 20260508000000 | ...` (Local and Remote both present).

- [ ] **Step 6: No commit needed**

Operational task; no local file changes.

---

### Task 7: Final verification

**Files:** none.

- [ ] **Step 1: Full local verification**

```bash
./scripts/reset-db.sh && supabase test db && npm run lint && npm run typecheck && npm run build && npm run test:smoke
```

Expected: all six exit 0. Smoke test still passes (cases data is present but the dashboard doesn't display it yet — frontend wiring is sub-project 2.6).

- [ ] **Step 2: Confirm git log**

```bash
git log --oneline | head -8
```

Expected: 5 implementation commits + the spec/plan commits + sub-project 2c env merge as the start.

- [ ] **Step 3: Hand off**

Plan is complete. Use `superpowers:finishing-a-development-branch` to merge `feat/cases-schema` to main.

---

## Verification (full plan complete)

After Task 7:
- Local: `cases` and `case_locations` tables exist with 10 + 28 seeded rows.
- Local: full pgTAP suite (8 files) green.
- Local: smoke test still passes (frontend unchanged).
- Remote: schema applied; `/rest/v1/cases` responds 200 with `[]`; anon write returns 42501.
- `supabase migration list`: both migrations on Local and Remote.

## Out of scope (next sub-project)

- Sub-project 2.6: Ops Console UI rebuild consuming cases + case_locations
- Sub-project 3: data pipeline writing to cases table
- pgvector / semantic search on dossier text
- `case_events` join table
- Audit log on cases status transitions
