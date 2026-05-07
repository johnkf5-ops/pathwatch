# Pathwatch — Database Schema Design

**Date:** 2026-05-07
**Sub-project:** 1 of 4 (DB schema → Frontend → Data pipeline → Snapshot/analysis)
**Status:** Draft, awaiting user review

## Context

Pathwatch is a real-time disease outbreak tracker. V1 covers the active **MV Hondius hantavirus outbreak** (Andes orthohantavirus / ANDV) — first reported to WHO 2026-05-02, ~8 cases / 3 deaths as of 2026-05-07, multi-country passenger dispersion from a cruise ship anchored off Cape Verde.

Canonical sources for the data pipeline:
- WHO Disease Outbreak News (DON 2026-DON599)
- CDC newsroom
- ECDC assessment
- Africa CDC statement
- X/Twitter, Reddit, BlueSky, Google News (per [PATHWATCH_SPEC.md](../../../../Downloads/PATHWATCH_SPEC.md))

This document covers **only the database schema**. Frontend, data pipeline, and snapshot/analysis layer are separate design cycles.

## Goals

1. Public read-only Postgres schema on Supabase that the Next.js dashboard can query via the anon key.
2. Service-role write path for the data pipeline.
3. Realtime subscriptions on tables the dashboard cares about.
4. Cheap exact-URL dedup at the DB level; semantic dedup remains pipeline responsibility.
5. DB-enforced value constraints (CHECK) so TS types and Postgres agree on enums.

## Non-goals

- Multi-disease support. The schema keeps a `disease TEXT DEFAULT 'hantavirus'` column for future-proofing but does not normalize. Multi-disease is a v2 migration.
- Embedding-based semantic dedup. We are not adding pgvector. Pipeline does semantic dedup by re-reading recent events.
- Soft deletes. Append-only model — duplicates link via `duplicate_of`, they are not deleted.
- Auth. Dashboard is fully public, no user accounts.

## Schema

### Table: `events`

Atomic intelligence units. Each row is one deduplicated piece of information from one source.

```sql
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  occurred_at TIMESTAMPTZ,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  raw_content TEXT,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('x','cdc','who','google_news','reddit','bluesky','ecdc','africa_cdc','wikipedia')),
  source_url TEXT,
  source_url_hash TEXT GENERATED ALWAYS AS (md5(source_url)) STORED,
  source_author TEXT,
  significance INTEGER NOT NULL DEFAULT 1
    CHECK (significance BETWEEN 1 AND 5),
  category TEXT NOT NULL
    CHECK (category IN ('case_report','policy','research','travel_advisory','mutation','death','containment','speculation')),
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

-- Hot read path: dashboard feed excludes duplicates, sorts by created_at DESC
CREATE INDEX idx_events_feed ON events (created_at DESC) WHERE duplicate_of IS NULL;

-- Filters
CREATE INDEX idx_events_significance ON events (significance DESC);
CREATE INDEX idx_events_source_type ON events (source_type);
CREATE INDEX idx_events_country_code ON events (country_code);
CREATE INDEX idx_events_category ON events (category);
CREATE INDEX idx_events_disease ON events (disease);
CREATE INDEX idx_events_tags ON events USING GIN (tags);

-- Exact-URL dedup. Partial so multiple NULL urls are allowed.
CREATE UNIQUE INDEX idx_events_source_url_hash
  ON events (source_url_hash) WHERE source_url_hash IS NOT NULL;
```

Why these choices:

- `source_url_hash` is a generated column (auto-computed by Postgres on insert) so the pipeline never needs to compute MD5 itself. The partial unique index makes duplicate URLs a hard error, not a soft check.
- The `idx_events_feed` partial index matches the dashboard's exact query pattern (`WHERE duplicate_of IS NULL ORDER BY created_at DESC`). It excludes duplicates from the index itself, keeping it small and fast.
- `tags` GIN index supports `tags @> ARRAY['...']` queries for tag-based filtering (e.g. filtering on strain `andes`, transmission mode `human-to-human`, or vessel `mv-hondius`).
- CHECK constraints over native ENUMs because adding a new source/category to an ENUM requires `ALTER TYPE` migrations; CHECK is a one-line ALTER TABLE.
- `is_verified NOT NULL DEFAULT false` — pipeline explicitly opts a row in. No tri-state.

### Table: `snapshots`

Periodic situation rollups, append-only. Powers the situation overview panel.

```sql
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

Why a table and not a view: `trend_description`, `key_developments`, `ai_analysis` are LLM-generated narrative, not derivable from `events`. Aggregates (`total_cases`, etc.) live alongside narrative in the same row so the dashboard reads one row.

### Table: `country_stats`

Per-country state. Pipeline upserts.

```sql
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

Same justification as snapshots: `status`, `travel_advisory`, `notes` are LLM-curated state, not derivable. The UNIQUE constraint makes upserts safe (`ON CONFLICT (disease, country_code) DO UPDATE`).

### Table: `scrape_log`

Pipeline observability. Not exposed to the dashboard.

```sql
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

## Row-Level Security

```sql
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_public_read ON events FOR SELECT USING (true);

ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY snapshots_public_read ON snapshots FOR SELECT USING (true);

ALTER TABLE country_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY country_stats_public_read ON country_stats FOR SELECT USING (true);

ALTER TABLE scrape_log ENABLE ROW LEVEL SECURITY;
-- No SELECT policy — anon can't read scrape_log at all.
```

Default-deny: with RLS enabled and only SELECT policies present, anon clients cannot INSERT/UPDATE/DELETE any table. The service role bypasses RLS, so the pipeline writes freely.

## Realtime publication

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE country_stats;
```

The dashboard subscribes to INSERTs on all three. `country_stats` also gets UPDATEs (upserts surface as updates after the first insert per country).

## Deliverable shape

```
project_contagion/
├── supabase/
│   ├── migrations/
│   │   └── 20260507000000_initial_schema.sql   # All DDL above
│   └── seed.sql                                # Dev seed data
├── scripts/
│   └── reset-db.sh                             # supabase db reset (local only)
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-05-07-pathwatch-db-schema-design.md  # this file
```

Migration is a single SQL file. Two workflows:

- **Local dev:** `supabase db reset` drops the local DB, reapplies migrations, runs `seed.sql`. Used for fast iteration.
- **Remote (Supabase project):** `supabase db push` applies pending migrations to the linked remote project. Seed is **not** run remotely — production data comes from the pipeline.

The pipeline gets the URL + service-role key from env. The frontend gets the URL + anon key.

## Seed data

`supabase/seed.sql` inserts approximately:

- **20 events** drawn from the actual MV Hondius outbreak:
  - WHO DON 2026-DON599 announcement (significance 5, category `case_report`, source `who`)
  - CDC newsroom release (significance 4, source `cdc`)
  - ECDC risk assessment (significance 4, source `ecdc`)
  - Africa CDC multi-country statement (significance 3, source `africa_cdc`)
  - Maria Van Kerkhove press conference (significance 4, category `policy`, source `who`)
  - Canary Islands docking refusal (significance 4, category `containment`, source `google_news`, country `ES`)
  - Switzerland confirmed case (significance 4, category `case_report`, country `CH`)
  - US monitoring statement for CA/GA/AZ returnees (significance 3, country `US`)
  - Andes orthohantavirus strain identification (significance 4, category `research`)
  - Reminder of ANDV human-to-human transmission history (significance 3, category `research`)
  - Reddit r/epidemiology discussion threads (significance 2, source `reddit`)
  - 2022 "soothsayer tweet" predicting "2026: Hantavirus" (significance 1, source `x`, category `speculation`)
  - Plus 8 more across X/BlueSky/Google News spanning all significance/category combinations
- **1 snapshot:** total_cases=8, total_deaths=3, countries_affected=5, fatality_rate=0.375, trend=`accelerating`, risk_level=`moderate`, with AI analysis describing the cruise ship vector
- **5 country_stats** rows: AR (origin), CL (origin), NL (Dutch index couple), CV (current ship anchorage), CH (confirmed case)

Seed data is committed to the repo. Reset workflow: `supabase db reset` (drops data, reapplies migrations + seed).

## Testing

Three checks, all runnable via `psql` against a local Supabase instance:

1. **Migration applies cleanly:** `psql --set=ON_ERROR_STOP=on -f supabase/migrations/20260507000000_initial_schema.sql` succeeds on an empty DB.
2. **Dedup constraint works:** insert two events with identical `source_url`, second fails with unique violation on `idx_events_source_url_hash`.
3. **RLS works:** with the anon key, `SELECT * FROM events` returns rows; `INSERT INTO events (...)` returns permission denied. `SELECT * FROM scrape_log` returns zero rows (no policy means no access).

## Risks and open questions

- **Generated column for hash:** requires Postgres 12+. Supabase is on 15+, so safe.
- **Partial unique index on hash:** allows multiple NULL urls. Intentional — some events (Reddit threads, X posts) may not have stable URLs at scrape time. Pipeline owns the call.
- **Source list is not exhaustive:** added ECDC, Africa CDC, Wikipedia based on the actual outbreak's canonical sources. If new sources surface (ProMED, country health ministries) we add via `ALTER TABLE events DROP CONSTRAINT ... ADD CONSTRAINT ...`.
- **No pgvector:** if semantic dedup quality turns out to be poor when the pipeline hits >100 events/day, we revisit. Schema migration to add `embedding VECTOR(1536)` + HNSW index is straightforward.
- **No FTS:** same logic. Add `tsvector` + GIN if search becomes a feature.

## Out of scope (deferred to later sub-projects)

- Frontend query helpers (`lib/supabase.ts`, query patterns) — sub-project 2.
- Pipeline ingestion logic (dedup decisions, scoring rubric, geocoding) — sub-project 3.
- Snapshot generation cadence and trigger — sub-project 4.
