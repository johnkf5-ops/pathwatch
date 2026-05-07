# Pathwatch DB Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the initial Pathwatch Supabase schema (events, snapshots, country_stats, scrape_log) plus realistic seed data from the active MV Hondius hantavirus outbreak. Sub-project 1 of 4 — no frontend, no scraping pipeline.

**Architecture:** Single migration SQL file applied via `supabase db push` (remote) or `supabase db reset` (local). Tests live alongside in `supabase/tests/database/` and run via `supabase test db` using pgTAP. Seed data hits the local DB on reset, not production.

**Tech Stack:** Supabase CLI, PostgreSQL 15+, pgTAP for tests, Docker (for local Supabase stack). All work happens in `/Users/claude/Projects/project_contagion`.

**Spec:** `docs/superpowers/specs/2026-05-07-pathwatch-db-schema-design.md`

**Prerequisites (verify once before starting):**
- Supabase CLI installed: `supabase --version` returns ≥ 1.165
- Docker Desktop running: `docker info` succeeds
- Working directory: `/Users/claude/Projects/project_contagion`
- Git repo initialized (it is — initial spec commit on `main`)

---

### Task 1: Initialize Supabase project + pgTAP smoke test

**Files:**
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `supabase/tests/database/00_smoke.test.sql`
- Create: `.gitignore`

- [ ] **Step 1: Run `supabase init`**

Run from `/Users/claude/Projects/project_contagion`:
```bash
supabase init
```
Expected: prints `Finished supabase init.` and creates `supabase/config.toml`, `supabase/seed.sql` (empty), and a few other files. Answer `N` to any "generate VS Code settings?" prompt.

- [ ] **Step 2: Start the local stack to verify it works**

```bash
supabase start
```
Expected: prints "Started supabase local development setup" and a block of URLs/keys. Note the `DB URL` (defaults to `postgresql://postgres:postgres@127.0.0.1:54322/postgres`). Takes 1–2 minutes on first run because it pulls Docker images.

- [ ] **Step 3: Add `.gitignore` for Supabase local artifacts**

Create `/Users/claude/Projects/project_contagion/.gitignore`:
```
# Supabase local
supabase/.branches/
supabase/.temp/

# OS
.DS_Store

# Node (will appear later when frontend is added)
node_modules/
```

- [ ] **Step 4: Write the smoke test**

Create `/Users/claude/Projects/project_contagion/supabase/tests/database/00_smoke.test.sql`:
```sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO extensions, public;

SELECT plan(1);

SELECT ok(true, 'pgTAP harness works');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 5: Run the test**

```bash
supabase test db
```
Expected: prints `00_smoke.test.sql .. ok` and `All tests successful.`

- [ ] **Step 6: Commit**

```bash
git add .gitignore supabase/
git commit -m "$(cat <<'EOF'
Initialize Supabase project and pgTAP smoke test

Run 'supabase init' to scaffold the local project. Add a one-assertion
pgTAP smoke test to verify 'supabase test db' is wired up before any
real test or migration is added.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Build the `events` table (TDD)

**Files:**
- Create: `supabase/tests/database/01_events.test.sql`
- Create: `supabase/migrations/20260507000000_initial_schema.sql`

- [ ] **Step 1: Write the failing test**

Create `/Users/claude/Projects/project_contagion/supabase/tests/database/01_events.test.sql`:
```sql
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
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
supabase test db
```
Expected: `01_events.test.sql` fails with errors like `relation "events" does not exist`.

- [ ] **Step 3: Create the migration with the events table**

Create `/Users/claude/Projects/project_contagion/supabase/migrations/20260507000000_initial_schema.sql`:
```sql
-- Pathwatch initial schema
-- Sub-project 1 of 4: events, snapshots, country_stats, scrape_log + RLS + realtime

-- ============================================================
-- events
-- ============================================================
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  occurred_at TIMESTAMPTZ,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  raw_content TEXT,
  source_type TEXT NOT NULL,
  source_url TEXT,
  source_url_hash TEXT GENERATED ALWAYS AS (md5(source_url)) STORED,
  source_author TEXT,
  significance INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL,
  country_code TEXT,
  region TEXT,
  location_name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  case_count INTEGER,
  death_count INTEGER,
  is_verified BOOLEAN DEFAULT false NOT NULL,
  tags TEXT[],
  duplicate_of UUID REFERENCES events(id),
  disease TEXT DEFAULT 'hantavirus' NOT NULL
);
```

- [ ] **Step 4: Re-run the test and verify it passes**

```bash
supabase db reset
supabase test db
```
Expected: `01_events.test.sql .. ok` and the smoke test still passes.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/ supabase/tests/database/01_events.test.sql
git commit -m "$(cat <<'EOF'
Add events table and structural tests

Create the events table with all spec'd columns, NOT NULL constraints,
and the generated source_url_hash column. Tests cover column presence,
NOT NULL where required, and the primary key. CHECKs and indexes
land in subsequent commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add CHECK constraints to `events` (TDD)

**Files:**
- Modify: `supabase/tests/database/01_events.test.sql`
- Modify: `supabase/migrations/20260507000000_initial_schema.sql`

- [ ] **Step 1: Add failing CHECK tests**

Open `supabase/tests/database/01_events.test.sql`. Change `SELECT plan(33);` to `SELECT plan(39);`. Before `SELECT * FROM finish();` add:

```sql
-- CHECK constraints
SELECT col_has_check('events', 'source_type');
SELECT col_has_check('events', 'category');
SELECT col_has_check('events', 'significance');

-- Reject unknown source_type
SELECT throws_ok(
  $$INSERT INTO events (title, summary, source_type, category) VALUES ('t','s','tiktok','case_report')$$,
  '23514',
  NULL,
  'rejects unknown source_type'
);

-- Reject unknown category
SELECT throws_ok(
  $$INSERT INTO events (title, summary, source_type, category) VALUES ('t','s','x','memes')$$,
  '23514',
  NULL,
  'rejects unknown category'
);

-- Reject out-of-range significance
SELECT throws_ok(
  $$INSERT INTO events (title, summary, source_type, category, significance) VALUES ('t','s','x','case_report',9)$$,
  '23514',
  NULL,
  'rejects significance > 5'
);
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
supabase db reset
supabase test db
```
Expected: the new assertions fail because no CHECK constraints exist yet.

- [ ] **Step 3: Add CHECK constraints to the migration**

In `supabase/migrations/20260507000000_initial_schema.sql`, replace the three columns inside `CREATE TABLE events` as follows:

Replace `source_type TEXT NOT NULL,` with:
```sql
  source_type TEXT NOT NULL
    CHECK (source_type IN ('x','cdc','who','google_news','reddit','bluesky','ecdc','africa_cdc','wikipedia')),
```

Replace `significance INTEGER NOT NULL DEFAULT 1,` with:
```sql
  significance INTEGER NOT NULL DEFAULT 1
    CHECK (significance BETWEEN 1 AND 5),
```

Replace `category TEXT NOT NULL,` with:
```sql
  category TEXT NOT NULL
    CHECK (category IN ('case_report','policy','research','travel_advisory','mutation','death','containment','speculation')),
```

- [ ] **Step 4: Re-run the test and verify it passes**

```bash
supabase db reset
supabase test db
```
Expected: all 39 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/ supabase/tests/database/01_events.test.sql
git commit -m "$(cat <<'EOF'
Add events CHECK constraints

CHECK on source_type, category, significance to keep TS types and the
DB in sync. Avoids native ENUMs because adding new values to ENUMs
requires ALTER TYPE migrations vs. one-line ALTER TABLE.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Add dedup unique index + indexes (TDD)

**Files:**
- Modify: `supabase/tests/database/01_events.test.sql`
- Modify: `supabase/migrations/20260507000000_initial_schema.sql`

- [ ] **Step 1: Add failing dedup + index tests**

Open `supabase/tests/database/01_events.test.sql`. Change `SELECT plan(39);` to `SELECT plan(49);`. Before `SELECT * FROM finish();` add:

```sql
-- Indexes
SELECT has_index('events', 'idx_events_feed');
SELECT has_index('events', 'idx_events_significance');
SELECT has_index('events', 'idx_events_source_type');
SELECT has_index('events', 'idx_events_country_code');
SELECT has_index('events', 'idx_events_category');
SELECT has_index('events', 'idx_events_disease');
SELECT has_index('events', 'idx_events_tags');
SELECT has_index('events', 'idx_events_source_url_hash');

-- Dedup: same URL twice rejected
SELECT lives_ok(
  $$INSERT INTO events (title, summary, source_type, category, source_url) VALUES ('a','b','x','case_report','https://example.com/x')$$,
  'first insert with URL succeeds'
);
SELECT throws_ok(
  $$INSERT INTO events (title, summary, source_type, category, source_url) VALUES ('c','d','x','case_report','https://example.com/x')$$,
  '23505',
  NULL,
  'second insert with same URL rejected (unique violation on source_url_hash)'
);
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
supabase db reset
supabase test db
```
Expected: index assertions and the dedup `throws_ok` fail (no indexes yet).

- [ ] **Step 3: Add indexes to the migration**

In `supabase/migrations/20260507000000_initial_schema.sql`, after the `CREATE TABLE events (...)` block, append:

```sql
-- events indexes
CREATE INDEX idx_events_feed ON events (created_at DESC) WHERE duplicate_of IS NULL;
CREATE INDEX idx_events_significance ON events (significance DESC);
CREATE INDEX idx_events_source_type ON events (source_type);
CREATE INDEX idx_events_country_code ON events (country_code);
CREATE INDEX idx_events_category ON events (category);
CREATE INDEX idx_events_disease ON events (disease);
CREATE INDEX idx_events_tags ON events USING GIN (tags);
CREATE UNIQUE INDEX idx_events_source_url_hash
  ON events (source_url_hash) WHERE source_url_hash IS NOT NULL;
```

- [ ] **Step 4: Re-run the test and verify it passes**

```bash
supabase db reset
supabase test db
```
Expected: all 49 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/ supabase/tests/database/01_events.test.sql
git commit -m "$(cat <<'EOF'
Add events indexes and exact-URL dedup constraint

Partial index on (created_at DESC) WHERE duplicate_of IS NULL matches
the dashboard's hot read path. GIN on tags supports tag containment
queries. Unique partial index on source_url_hash makes duplicate URLs
a hard error while still allowing multiple NULL urls (Reddit threads,
X posts without stable links).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Build `snapshots` table (TDD)

**Files:**
- Create: `supabase/tests/database/02_snapshots.test.sql`
- Modify: `supabase/migrations/20260507000000_initial_schema.sql`

- [ ] **Step 1: Write the failing test**

Create `/Users/claude/Projects/project_contagion/supabase/tests/database/02_snapshots.test.sql`:
```sql
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
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
supabase db reset
supabase test db
```
Expected: `02_snapshots.test.sql` fails — snapshots table does not exist.

- [ ] **Step 3: Add the snapshots table to the migration**

Append to `supabase/migrations/20260507000000_initial_schema.sql`:
```sql

-- ============================================================
-- snapshots
-- ============================================================
CREATE TABLE snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  disease TEXT DEFAULT 'hantavirus' NOT NULL,
  total_cases INTEGER,
  total_deaths INTEGER,
  countries_affected INTEGER,
  countries_list TEXT[],
  fatality_rate DOUBLE PRECISION,
  trend TEXT CHECK (trend IN ('accelerating','stable','declining')),
  trend_description TEXT,
  risk_level TEXT CHECK (risk_level IN ('low','moderate','high','critical')),
  key_developments TEXT[],
  ai_analysis TEXT
);

CREATE INDEX idx_snapshots_created_at ON snapshots (created_at DESC);
CREATE INDEX idx_snapshots_disease ON snapshots (disease);
```

- [ ] **Step 4: Re-run the test and verify it passes**

```bash
supabase db reset
supabase test db
```
Expected: all 20 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/ supabase/tests/database/02_snapshots.test.sql
git commit -m "$(cat <<'EOF'
Add snapshots table

Append-only table for periodic situation rollups. Aggregates and
LLM-generated narrative live in one row so the dashboard reads a single
record. CHECKs on trend and risk_level enforce the enum.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Build `country_stats` table (TDD)

**Files:**
- Create: `supabase/tests/database/03_country_stats.test.sql`
- Modify: `supabase/migrations/20260507000000_initial_schema.sql`

- [ ] **Step 1: Write the failing test**

Create `/Users/claude/Projects/project_contagion/supabase/tests/database/03_country_stats.test.sql`:
```sql
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
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
supabase db reset
supabase test db
```
Expected: `03_country_stats.test.sql` fails — table does not exist.

- [ ] **Step 3: Add the country_stats table to the migration**

Append to `supabase/migrations/20260507000000_initial_schema.sql`:
```sql

-- ============================================================
-- country_stats
-- ============================================================
CREATE TABLE country_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  disease TEXT DEFAULT 'hantavirus' NOT NULL,
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  cases INTEGER DEFAULT 0 NOT NULL,
  deaths INTEGER DEFAULT 0 NOT NULL,
  first_case_date DATE,
  latest_case_date DATE,
  status TEXT CHECK (status IN ('active','contained','monitoring','clear')),
  travel_advisory TEXT,
  notes TEXT,
  UNIQUE (disease, country_code)
);

CREATE INDEX idx_country_stats_country ON country_stats (country_code);
CREATE INDEX idx_country_stats_disease ON country_stats (disease);
```

- [ ] **Step 4: Re-run the test and verify it passes**

```bash
supabase db reset
supabase test db
```
Expected: all 18 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/ supabase/tests/database/03_country_stats.test.sql
git commit -m "$(cat <<'EOF'
Add country_stats table

Per-country state with UNIQUE(disease, country_code) so the pipeline can
upsert via ON CONFLICT. Holds LLM-curated fields (status, travel_advisory,
notes) alongside aggregates that the pipeline maintains.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Build `scrape_log` table (TDD)

**Files:**
- Create: `supabase/tests/database/04_scrape_log.test.sql`
- Modify: `supabase/migrations/20260507000000_initial_schema.sql`

- [ ] **Step 1: Write the failing test**

Create `/Users/claude/Projects/project_contagion/supabase/tests/database/04_scrape_log.test.sql`:
```sql
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
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
supabase db reset
supabase test db
```
Expected: `04_scrape_log.test.sql` fails.

- [ ] **Step 3: Add the scrape_log table to the migration**

Append to `supabase/migrations/20260507000000_initial_schema.sql`:
```sql

-- ============================================================
-- scrape_log (pipeline observability; not exposed to dashboard)
-- ============================================================
CREATE TABLE scrape_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  source_type TEXT NOT NULL,
  query TEXT,
  results_found INTEGER DEFAULT 0,
  events_created INTEGER DEFAULT 0,
  duplicates_skipped INTEGER DEFAULT 0,
  error TEXT,
  duration_ms INTEGER
);

CREATE INDEX idx_scrape_log_created_at ON scrape_log (created_at DESC);
CREATE INDEX idx_scrape_log_source_type ON scrape_log (source_type);
```

- [ ] **Step 4: Re-run the test and verify it passes**

```bash
supabase db reset
supabase test db
```
Expected: all 13 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/ supabase/tests/database/04_scrape_log.test.sql
git commit -m "$(cat <<'EOF'
Add scrape_log table

Pipeline observability table: one row per scrape cycle per source.
Not exposed to the dashboard - RLS in the next commit will lock it down.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Add Row-Level Security (TDD)

**Files:**
- Create: `supabase/tests/database/05_rls.test.sql`
- Modify: `supabase/migrations/20260507000000_initial_schema.sql`

- [ ] **Step 1: Write the failing RLS test**

Create `/Users/claude/Projects/project_contagion/supabase/tests/database/05_rls.test.sql`:
```sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO extensions, public;

SELECT plan(12);

-- Seed one row in each public table from a privileged role so anon has something to read
INSERT INTO events (title, summary, source_type, category)
  VALUES ('rls-fixture','rls-fixture','x','case_report');
INSERT INTO snapshots (disease) VALUES ('hantavirus');
INSERT INTO country_stats (disease, country_code, country_name)
  VALUES ('hantavirus','ZZ','Fixture');
INSERT INTO scrape_log (source_type) VALUES ('x');

-- RLS enabled on all four tables
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'events'),
  true,
  'RLS enabled on events'
);
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'snapshots'),
  true,
  'RLS enabled on snapshots'
);
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'country_stats'),
  true,
  'RLS enabled on country_stats'
);
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'scrape_log'),
  true,
  'RLS enabled on scrape_log'
);

-- Switch to anon and verify
SET ROLE anon;

SELECT cmp_ok(
  (SELECT count(*)::int FROM events), '>=', 1,
  'anon can SELECT events'
);
SELECT cmp_ok(
  (SELECT count(*)::int FROM snapshots), '>=', 1,
  'anon can SELECT snapshots'
);
SELECT cmp_ok(
  (SELECT count(*)::int FROM country_stats), '>=', 1,
  'anon can SELECT country_stats'
);

SELECT throws_ok(
  $$INSERT INTO events (title, summary, source_type, category) VALUES ('x','y','x','case_report')$$,
  '42501',
  NULL,
  'anon cannot INSERT events'
);
SELECT throws_ok(
  $$INSERT INTO snapshots (disease) VALUES ('hantavirus')$$,
  '42501',
  NULL,
  'anon cannot INSERT snapshots'
);
SELECT throws_ok(
  $$INSERT INTO country_stats (disease, country_code, country_name) VALUES ('hantavirus','YY','y')$$,
  '42501',
  NULL,
  'anon cannot INSERT country_stats'
);

-- scrape_log: RLS on, no policy → anon sees zero rows
SELECT is(
  (SELECT count(*)::int FROM scrape_log), 0,
  'anon sees no scrape_log rows'
);
SELECT throws_ok(
  $$INSERT INTO scrape_log (source_type) VALUES ('x')$$,
  '42501',
  NULL,
  'anon cannot INSERT scrape_log'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
supabase db reset
supabase test db
```
Expected: `05_rls.test.sql` fails — RLS not yet enabled, anon may be able to INSERT.

- [ ] **Step 3: Add RLS to the migration**

Append to `supabase/migrations/20260507000000_initial_schema.sql`:
```sql

-- ============================================================
-- Row-Level Security
-- ============================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_public_read ON events FOR SELECT USING (true);

ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY snapshots_public_read ON snapshots FOR SELECT USING (true);

ALTER TABLE country_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY country_stats_public_read ON country_stats FOR SELECT USING (true);

ALTER TABLE scrape_log ENABLE ROW LEVEL SECURITY;
-- No SELECT policy: anon gets zero rows back, all writes fail.
```

- [ ] **Step 4: Re-run the test and verify it passes**

```bash
supabase db reset
supabase test db
```
Expected: all 12 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/ supabase/tests/database/05_rls.test.sql
git commit -m "$(cat <<'EOF'
Enable RLS with public-read policies on dashboard tables

events, snapshots, country_stats: anon can SELECT, all writes denied.
scrape_log: RLS on with no SELECT policy - anon cannot read or write.
Service role bypasses RLS so the data pipeline writes freely.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Add Realtime publication (TDD)

**Files:**
- Create: `supabase/tests/database/06_realtime.test.sql`
- Modify: `supabase/migrations/20260507000000_initial_schema.sql`

- [ ] **Step 1: Write the failing realtime test**

Create `/Users/claude/Projects/project_contagion/supabase/tests/database/06_realtime.test.sql`:
```sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path TO extensions, public;

SELECT plan(3);

-- Each table must be in the supabase_realtime publication
SELECT is(
  (SELECT count(*)::int
     FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'events'),
  1,
  'events is in supabase_realtime publication'
);
SELECT is(
  (SELECT count(*)::int
     FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'snapshots'),
  1,
  'snapshots is in supabase_realtime publication'
);
SELECT is(
  (SELECT count(*)::int
     FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'country_stats'),
  1,
  'country_stats is in supabase_realtime publication'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
supabase db reset
supabase test db
```
Expected: `06_realtime.test.sql` fails — tables not yet added to publication.

- [ ] **Step 3: Add publication membership to the migration**

Append to `supabase/migrations/20260507000000_initial_schema.sql`:
```sql

-- ============================================================
-- Realtime publication
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE country_stats;
```

- [ ] **Step 4: Re-run the test and verify it passes**

```bash
supabase db reset
supabase test db
```
Expected: all assertions pass — full test suite green.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/ supabase/tests/database/06_realtime.test.sql
git commit -m "$(cat <<'EOF'
Add events, snapshots, country_stats to supabase_realtime publication

The dashboard subscribes to INSERTs on all three tables. country_stats
also surfaces UPDATEs (the pipeline upserts).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Write seed data (MV Hondius outbreak)

**Files:**
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Write the seed file**

Replace the contents of `/Users/claude/Projects/project_contagion/supabase/seed.sql` with:

```sql
-- Pathwatch dev seed data
-- Real-world MV Hondius hantavirus (Andes orthohantavirus / ANDV) outbreak,
-- first reported to WHO 2026-05-02. Snapshot reflects state at 2026-05-07.
-- Seeded by `supabase db reset` only - never run in production.

-- ============================================================
-- country_stats
-- ============================================================
INSERT INTO country_stats (disease, country_code, country_name, cases, deaths, first_case_date, latest_case_date, status, travel_advisory, notes) VALUES
  ('hantavirus','AR','Argentina',2,0,'2026-04-06','2026-04-28','monitoring','CDC Level 2: Practice Enhanced Precautions in Patagonia','Index exposure: Dutch couple birdwatching near Ushuaia'),
  ('hantavirus','CL','Chile',1,0,'2026-04-10','2026-04-10','monitoring','CDC Level 2: Patagonia/southern regions',NULL),
  ('hantavirus','NL','Netherlands',2,2,'2026-04-15','2026-04-22','active',NULL,'Dutch index couple, both deceased'),
  ('hantavirus','CH','Switzerland',1,0,'2026-05-06','2026-05-06','active',NULL,'First non-passenger contact case (intimate partner of returnee)'),
  ('hantavirus','CV','Cape Verde',2,1,'2026-04-29','2026-05-04','active','WHO advisory: limit non-essential travel','MV Hondius currently anchored off Praia');

-- ============================================================
-- events (20 rows spanning all sources, significance levels, categories)
-- ============================================================
INSERT INTO events (occurred_at, title, summary, source_type, source_url, source_author, significance, category, country_code, region, location_name, latitude, longitude, case_count, death_count, is_verified, tags) VALUES
  -- Significance 5: Critical
  ('2026-05-02 14:00:00+00','WHO confirms hantavirus cluster aboard cruise ship MV Hondius',
    'WHO Disease Outbreak News (DON 2026-DON599) confirms 8 cases of Andes orthohantavirus among passengers and crew of the MV Hondius cruise ship. Three deaths reported. Index exposure traced to a pre-cruise birdwatching expedition near Ushuaia.',
    'who','https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON599','WHO',5,'case_report','CV','Praia','MV Hondius, off Praia, Cape Verde',14.93,-23.51,8,3,true,
    ARRAY['andes-virus','mv-hondius','cruise-ship','who-don']),
  ('2026-05-04 09:00:00+00','Cape Verde refuses MV Hondius docking; WHO coordinates passenger evacuation',
    'Cape Verde authorities barred MV Hondius from docking at Praia after the second on-board death. WHO is coordinating with member states for passenger evacuation. ~600 passengers and crew from 23 nationalities.',
    'who','https://www.who.int/news/item/04-05-2026-mv-hondius-passenger-evacuation','WHO',5,'containment','CV','Praia','MV Hondius',14.93,-23.51,NULL,1,true,
    ARRAY['mv-hondius','cruise-ship','containment']),

  -- Significance 4: High
  ('2026-05-07 13:00:00+00','WHO press conference: Andes virus is human-transmissible but requires close contact',
    'Maria Van Kerkhove (WHO) explicitly differentiated this outbreak from COVID-19 in a press briefing today. ANDV is the only hantavirus with documented human-to-human transmission, but only via close, intimate contact - not airborne community spread.',
    'who','https://www.who.int/news/item/07-05-2026-who-s-response-to-hantavirus-cases-linked-to-a-cruise-ship','Maria Van Kerkhove',4,'policy','CV',NULL,'WHO HQ Geneva (briefing on MV Hondius)',NULL,NULL,NULL,NULL,true,
    ARRAY['andes-virus','transmission','press-briefing','van-kerkhove']),
  ('2026-05-06 17:00:00+00','CDC: Risk to American public extremely low; CA, GA, AZ monitoring returnees',
    'CDC newsroom release confirms US health departments in California, Georgia, and Arizona are conducting active monitoring of MV Hondius passengers who returned home. No US cases. Public risk assessment: extremely low.',
    'cdc','https://www.cdc.gov/media/releases/2026-hantavirus-confirmed-cruise-ship.html','CDC',4,'policy','US',NULL,'United States',NULL,NULL,0,0,true,
    ARRAY['cdc','monitoring','contact-tracing']),
  ('2026-05-05 11:00:00+00','ECDC publishes rapid risk assessment of cruise ship hantavirus cluster',
    'ECDC rapid risk assessment classifies the outbreak as a low overall risk to the EU/EEA but elevated for direct MV Hondius contacts. Recommends member states prioritize symptomatic surveillance for returning passengers for 42 days.',
    'ecdc','https://www.ecdc.europa.eu/en/publications-data/hantavirus-associated-cluster-illness-cruise-ship-ecdc-assessment-and','ECDC',4,'research','NL',NULL,'Stockholm (ECDC HQ)',NULL,NULL,NULL,NULL,true,
    ARRAY['ecdc','risk-assessment','andes-virus']),
  ('2026-05-06 22:00:00+00','Switzerland confirms first secondary case: partner of MV Hondius returnee',
    'Swiss Federal Office of Public Health confirms a hantavirus case in the intimate partner of a passenger who returned from MV Hondius. First documented secondary (non-cruise) transmission in this outbreak.',
    'google_news','https://news.google.com/articles/swiss-hantavirus-secondary-case','BAG',4,'case_report','CH','Zurich','Zurich, Switzerland',47.37,8.55,1,0,true,
    ARRAY['secondary-transmission','andes-virus','close-contact']),

  -- Significance 3: Notable
  ('2026-05-04 18:00:00+00','Africa CDC issues statement on multi-country cruise ship cluster',
    'Africa CDC published a statement urging coordinated continental response after MV Hondius was denied docking at Canary Islands and Cape Verde. Recommends activation of regional event-based surveillance.',
    'africa_cdc','https://africacdc.org/news-item/statement-on-multi-country-hantavirus-cluster-associated-with-cruise-ship-travel/','Africa CDC',3,'policy','CV',NULL,'Addis Ababa (Africa CDC HQ)',NULL,NULL,NULL,NULL,true,
    ARRAY['africa-cdc','coordination']),
  ('2026-05-03 16:00:00+00','Andes orthohantavirus confirmed via PCR; no atypical mutations detected',
    'Public Health Argentina laboratory confirmed Andes orthohantavirus (ANDV) via RT-PCR on samples from index couple. Sequencing in progress; preliminary read suggests no atypical mutations vs. reference Patagonian strain.',
    'cdc','https://www.cdc.gov/hantavirus/sequencing-update-2026.html','PHE Argentina',3,'research','AR','Patagonia','Buenos Aires lab',-34.6,-58.4,NULL,NULL,true,
    ARRAY['andes-virus','pcr','sequencing']),
  ('2026-05-05 20:00:00+00','r/epidemiology megathread: assessing the MV Hondius cluster',
    'Active discussion in r/epidemiology with input from several professional epidemiologists comparing this cluster to the 1996 El Bolsón outbreak (also ANDV person-to-person). Consensus: high CFR (35-40%) but limited transmission radius.',
    'reddit','https://www.reddit.com/r/epidemiology/comments/abc123/mv_hondius_andv_megathread/','u/epi_phd',3,'research',NULL,NULL,NULL,NULL,NULL,NULL,NULL,false,
    ARRAY['reddit','megathread','el-bolson-1996','cfr']),
  ('2026-05-07 08:00:00+00','MV Hondius passenger interviews: contact tracing across 23 nationalities',
    'WHO and member states are conducting interviews with all 600+ MV Hondius passengers and crew. Passengers from 23 countries; tracing complicated by post-disembarkation dispersal across 5 continents.',
    'google_news','https://news.google.com/articles/mv-hondius-tracing-23-nationalities','Reuters',3,'containment','CV',NULL,'MV Hondius (off Praia)',14.93,-23.51,NULL,NULL,true,
    ARRAY['contact-tracing','mv-hondius']),

  -- Significance 2: Low
  ('2026-05-06 10:00:00+00','Dutch infectious disease physician thread on ANDV transmission',
    'Dr. Jan de Vries (@drjandevries) posted a thread explaining ANDV transmission for laypeople: contact with rodent excreta (primary) or close intimate/household contact with symptomatic patient (rare).',
    'x','https://x.com/drjandevries/status/123456','@drjandevries',2,'research','NL',NULL,NULL,NULL,NULL,NULL,NULL,false,
    ARRAY['x','explainer','transmission']),
  ('2026-05-05 14:00:00+00','BlueSky thread: comparing MV Hondius to historical hantavirus clusters',
    'Public health researcher posts comparison of MV Hondius to 1993 Four Corners outbreak and 1996 El Bolsón cluster. Notable: maritime vector is unprecedented for ANDV.',
    'bluesky','https://bsky.app/profile/example.bsky.social/post/abc','@phd-epi.bsky.social',2,'research',NULL,NULL,NULL,NULL,NULL,NULL,NULL,false,
    ARRAY['bluesky','historical-comparison']),
  ('2026-05-04 03:00:00+00','Wikipedia article created for MV Hondius hantavirus outbreak',
    'A new Wikipedia article documenting the outbreak was created and is being actively edited. Cited from WHO DON, CDC, ECDC, Africa CDC sources.',
    'wikipedia','https://en.wikipedia.org/wiki/MV_Hondius_hantavirus_outbreak','Wikipedia editors',2,'research',NULL,NULL,NULL,NULL,NULL,NULL,NULL,false,
    ARRAY['wikipedia','documentation']),
  ('2026-05-07 11:00:00+00','Reddit r/worldnews thread tracking MV Hondius developments',
    'Active r/worldnews thread (4k+ comments) tracking news as the situation develops. Mix of accurate reporting and speculation; mods pinning WHO updates at top.',
    'reddit','https://www.reddit.com/r/worldnews/comments/def456/mv_hondius/','u/news_mod',2,'speculation',NULL,NULL,NULL,NULL,NULL,NULL,NULL,false,
    ARRAY['reddit','worldnews']),

  -- Significance 1: Routine / speculation
  ('2026-05-03 20:00:00+00','Viral 2022 prediction tweet resurfaces: "2026: Hantavirus"',
    'A 2022 tweet that listed predicted pandemic events including "2026: Hantavirus" has gone viral with 200k+ retweets. Health communicators are pushing back on the framing.',
    'x','https://x.com/anonymous/status/2022-soothsayer','@anon_predictor',1,'speculation',NULL,NULL,NULL,NULL,NULL,NULL,NULL,false,
    ARRAY['x','speculation','viral','2022-prediction']),
  ('2026-05-06 15:00:00+00','Cruise industry stock dip on MV Hondius news',
    'Major cruise operator stocks (NCLH, RCL, CCL) dipped 3-5% intraday on initial MV Hondius coverage. Recovered partially after WHO clarified low broad-public risk.',
    'google_news','https://news.google.com/articles/cruise-stocks-mv-hondius','Bloomberg',1,'speculation','US',NULL,'New York',NULL,NULL,NULL,NULL,false,
    ARRAY['markets','cruise-industry']),

  -- More variety
  ('2026-05-07 06:00:00+00','Dutch index couple obituary published; family asks for privacy',
    'The family of the Dutch couple who died from ANDV after birdwatching in Patagonia issued a brief statement requesting media privacy. They were both retired biologists.',
    'google_news','https://news.google.com/articles/dutch-couple-obituary','NOS',3,'death','NL','Amsterdam','Netherlands',52.37,4.90,NULL,2,true,
    ARRAY['index-case','obituary']),
  ('2026-05-06 19:00:00+00','Travel advisory: Argentina extends Patagonia hantavirus warning to all foreign visitors',
    'Argentina Ministry of Health extended its standing Patagonia hantavirus advisory after MV Hondius coverage. Advises foreign visitors to avoid contact with rural rodents and abandoned structures.',
    'google_news','https://news.google.com/articles/argentina-advisory-extended','Telam',3,'travel_advisory','AR','Patagonia','Patagonia, Argentina',-43.3,-65.1,NULL,NULL,true,
    ARRAY['travel-advisory','patagonia']),
  ('2026-05-05 09:00:00+00','Chile health ministry: no new cases since 2026-04-10; surveillance heightened',
    'Chile Ministry of Health reports no new ANDV cases linked to MV Hondius since 2026-04-10. Surveillance heightened in Aysén and Magallanes regions.',
    'google_news','https://news.google.com/articles/chile-no-new-cases','Minsal',3,'case_report','CL','Aysen','Aysén, Chile',-46.0,-72.5,0,0,true,
    ARRAY['chile','surveillance']),
  ('2026-05-06 23:00:00+00','BlueSky post: MV Hondius timeline visualization',
    'Public health data visualization expert posted an interactive timeline of the MV Hondius outbreak from index exposure (April 1) to current state (May 7).',
    'bluesky','https://bsky.app/profile/datavisexpert.bsky.social/post/timeline','@datavisexpert.bsky.social',2,'research',NULL,NULL,NULL,NULL,NULL,NULL,NULL,false,
    ARRAY['bluesky','dataviz','timeline']);

-- ============================================================
-- snapshot (current situation as of 2026-05-07)
-- ============================================================
INSERT INTO snapshots (disease, total_cases, total_deaths, countries_affected, countries_list, fatality_rate, trend, trend_description, risk_level, key_developments, ai_analysis) VALUES
  ('hantavirus', 8, 3, 5, ARRAY['AR','CL','NL','CH','CV'], 0.375, 'accelerating',
    'Cluster is expanding through passenger dispersion rather than community transmission. New countries appearing weekly as MV Hondius passengers return home.',
    'moderate',
    ARRAY[
      'WHO DON 2026-DON599 published 2026-05-02',
      'First secondary (non-cruise) transmission confirmed in Switzerland 2026-05-06',
      'Cape Verde refused MV Hondius docking; ship anchored offshore',
      'CDC: US public risk extremely low; ECDC: EU/EEA risk low',
      'Andes orthohantavirus confirmed; no atypical mutations vs. reference strain'
    ],
    'The MV Hondius cluster is unusual in vector (maritime cruise ship) but consistent in pathogen (Andes orthohantavirus, the only hantavirus with documented human-to-human transmission via close contact). Eight confirmed cases including three deaths give a current CFR of ~37%, which aligns with historical ANDV CFR of 35-40%. The dispersion of ~600 passengers across 23 nationalities creates a broad surveillance challenge but the close-contact transmission mode means broad community spread is unlikely. Risk level moderate reflects multi-country dispersion offset by limited transmission radius. Watch for: new secondary cases in returnees'' households, sequencing results for any mutation signal, cruise industry policy changes.');
```

- [ ] **Step 2: Verify the seed applies cleanly**

```bash
supabase db reset
```
Expected: prints `Resetting local database...` then `Seeding data...` then `Finished supabase db reset.` with no errors.

- [ ] **Step 3: Verify counts**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "SELECT count(*) FROM events; SELECT count(*) FROM snapshots; SELECT count(*) FROM country_stats;"
```
Expected: events=20, snapshots=1, country_stats=5.

- [ ] **Step 4: Verify the test suite still passes after reset**

```bash
supabase test db
```
Expected: all tests green (tests use BEGIN/ROLLBACK so seed data doesn't affect them).

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql
git commit -m "$(cat <<'EOF'
Add MV Hondius outbreak seed data

20 events, 1 snapshot, 5 country_stats spanning all source types,
significance levels, and categories. Drawn from real outbreak state
as of 2026-05-07: WHO DON 2026-DON599, CDC/ECDC/Africa CDC statements,
Switzerland secondary case, the 2022 'soothsayer tweet', etc.

Seed runs only via 'supabase db reset' (local) - never in production.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Reset script + README

**Files:**
- Create: `scripts/reset-db.sh`
- Create: `README.md`

- [ ] **Step 1: Write the reset script**

Create `/Users/claude/Projects/project_contagion/scripts/reset-db.sh`:
```bash
#!/usr/bin/env bash
# Reset the local Supabase database: drops data, reapplies migrations, reruns seed.
# Local only - never run against the linked remote project.

set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found. Install: brew install supabase/tap/supabase" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop and retry." >&2
  exit 1
fi

cd "$(dirname "$0")/.."
supabase db reset
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/reset-db.sh
```

- [ ] **Step 3: Verify it runs**

```bash
./scripts/reset-db.sh
```
Expected: same output as `supabase db reset` directly.

- [ ] **Step 4: Write the README**

Create `/Users/claude/Projects/project_contagion/README.md`:
```markdown
# Pathwatch

Real-time disease outbreak tracker. V1 covers the 2026 MV Hondius hantavirus
outbreak (Andes orthohantavirus / ANDV).

This repo currently contains sub-project 1 of 4: the Supabase database schema.
The frontend dashboard, data pipeline, and snapshot/analysis layer are
separate work cycles.

## Prerequisites

- Docker Desktop, running
- Supabase CLI: `brew install supabase/tap/supabase` (macOS)
- PostgreSQL client tools (`psql`)

## Setup

```bash
supabase start          # spin up local stack (Postgres, PostgREST, Studio, etc.)
supabase db reset       # apply migrations + run seed.sql
```

Local URLs printed by `supabase start`:
- Postgres:  `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- API:       `http://127.0.0.1:54321`
- Studio:    `http://127.0.0.1:54323`

## Development workflow

```bash
./scripts/reset-db.sh   # convenience wrapper for `supabase db reset`
supabase test db        # run pgTAP tests in supabase/tests/database/
```

When you change the migration, re-run `./scripts/reset-db.sh` to drop and
reapply it. Tests run inside transactions and roll back, so they never
pollute the seeded dataset.

## Schema overview

Four tables (full DDL in `supabase/migrations/20260507000000_initial_schema.sql`):

- `events` - atomic intelligence units with URL-hash dedup, CHECK-constraint
  enums, and a partial index on the dashboard's hot read path.
- `snapshots` - append-only situation rollups (LLM-generated narrative + aggregates).
- `country_stats` - per-country state with `UNIQUE(disease, country_code)` for upsert.
- `scrape_log` - pipeline observability, RLS-locked from anon.

RLS lets the anon key SELECT from the first three; all writes require the
service role. `scrape_log` is service-role-only.

## Design

See `docs/superpowers/specs/2026-05-07-pathwatch-db-schema-design.md`.
```

- [ ] **Step 5: Commit**

```bash
git add scripts/reset-db.sh README.md
git commit -m "$(cat <<'EOF'
Add reset-db.sh and README

scripts/reset-db.sh wraps 'supabase db reset' with prereq checks
(docker running, supabase CLI installed). README documents setup,
dev workflow, and schema overview, and points at the design spec.

Sub-project 1 of 4 (DB schema) is done.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verification (full plan complete)

After Task 11, run this from `/Users/claude/Projects/project_contagion`:

```bash
./scripts/reset-db.sh && supabase test db
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "SELECT (SELECT count(*) FROM events) AS events, \
             (SELECT count(*) FROM snapshots) AS snapshots, \
             (SELECT count(*) FROM country_stats) AS country_stats;"
git log --oneline
```

Expected:
- All pgTAP tests green
- events=20, snapshots=1, country_stats=5
- ~12 commits on `main` (1 spec + 11 implementation tasks)

## Out of scope (next sub-projects)

- Frontend Next.js app, query helpers, types — sub-project 2
- Data pipeline scraping logic — sub-project 3
- Snapshot generation cadence — sub-project 4
