# Pathwatch — Cases + Travel Schema (Sub-project 2.5)

**Date:** 2026-05-08
**Sub-project:** 2.5 of N (this) → 2.6 Ops Console UI rebuild
**Status:** Draft, awaiting user review
**Depends on:** sub-project 1 (DB schema), already merged to main and pushed to remote at `wtatysorlkcteleqjzkm.supabase.co`

## Context

The dashboard tracks the MV Hondius hantavirus outbreak via aggregate counts (`country_stats.cases`, `country_stats.deaths`) and intelligence items (`events`). For the planned Ops Console UI rebuild (sub-project 2.6), we need cases as **first-class entities** so users can drill from country/marker → case list → individual dossier with movement history.

This sub-project adds two append-only tables (`cases`, `case_locations`) with RLS + Realtime, seeded with the real MV Hondius outbreak cases.

## Goals

1. Each known infected individual is a row with status, role, exposure metadata, and a narrative dossier — anonymized; no real names.
2. Each case has an ordered timeline of stops (`case_locations`) so the dashboard can render travel paths.
3. RLS + Realtime parity with existing tables — anon SELECT, service-role write only, INSERT/UPDATE pushed to subscribers.
4. Seeded with ~10 real MV Hondius cases (Dutch index couple, MV Hondius confirmed/suspected, Switzerland secondary, etc.) so the 2.6 UI has data to render on day one.
5. Migration is independent of existing tables — additive, doesn't touch `events`/`snapshots`/`country_stats`.

## Non-goals

- **PII storage.** We store `case_code`, age range, role, sex (M/F/U). No names, no contact info, no addresses beyond city-level `location_name`.
- **`case_events` join table.** Linking cases to specific intel items is YAGNI until the UI consumes it. Defer.
- **Audit log / version history** on cases. Pipeline UPSERTs in place; we trust pipeline correctness.
- **pgvector embeddings** on dossiers. Out of scope for v1.
- **Vaccination, hospitalization, sequencing** as columns. The schema can grow when needed; not adding speculative fields.

## Schema

### Table: `cases`

```sql
CREATE TABLE cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  case_code TEXT UNIQUE NOT NULL,
  disease TEXT DEFAULT 'hantavirus' NOT NULL,
  status TEXT NOT NULL CHECK (status IN
    ('suspected','confirmed','recovered','deceased','critical')),
  is_index_case BOOLEAN DEFAULT false NOT NULL,
  role TEXT CHECK (role IN
    ('passenger','crew','contact','healthcare_worker','rural_resident','other')),
  exposure_type TEXT CHECK (exposure_type IN
    ('rodent_contact','person_to_person','unknown')),
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

Field choices:

- **`case_code` UNIQUE NOT NULL:** human-readable stable id (`MVH-001`, `CH-001`). Pipeline assigns; never reused. Used in URLs (`/case/MVH-001`).
- **`status` CHECK:** five mutually-exclusive states. Pipeline transitions a case from `suspected` → `confirmed` → (`recovered` | `deceased` | `critical`). `critical` is intentionally a terminal-ish state for active life-threatening cases.
- **`is_index_case` partial index** so the dashboard can fetch index cases cheaply.
- **`role` CHECK:** six values covering MV Hondius cohort (passenger, crew, contact) plus `rural_resident` (typical pre-outbreak ANDV exposure) and `healthcare_worker` (occupational risk). `other` is the escape hatch.
- **`exposure_type` CHECK:** three values matching ANDV's known transmission modes plus `unknown`.
- **`age_range` plain TEXT** (no CHECK). Common values: `'0-9'`, `'10-19'`, ... `'90+'`. Free-form so pipeline can write `'unknown'` or `'30-39 (estimated)'` if it has to.
- **`sex` CHECK:** binary M/F plus U for unknown/unspecified. Conservative; we can extend later.
- **`exposure_country` / `current_country`:** ISO_A2 (matches `country_stats.country_code`). Indexed because the dashboard filters cases by both — "cases exposed in AR" vs "cases currently in CH."
- **`dossier`:** LLM-generated multi-paragraph narrative. Stored as TEXT. ~500–2000 characters typical.
- **`source_event_id` FK to events:** the canonical news/intel item that surfaced this case. Optional. ON DELETE SET NULL is implicit (no cascade needed; events delete is rare).
- **No FK on `disease`** — flat string, mirrors existing `events.disease` and `country_stats.disease` pattern.

### Table: `case_locations`

```sql
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

Field choices:

- **`case_id` ON DELETE CASCADE:** when a case is removed, its travel history goes with it. We don't soft-delete cases (the pipeline corrects status in place via UPSERT); cascade keeps the locations table clean.
- **`departed_at` nullable:** null means "still at this location" / current location. The latest stop with `departed_at = null` (or the latest `arrived_at` if all stops have departed) is the case's current position.
- **`is_exposure_site`:** boolean flag for the stop where infection occurred. Useful for the map ("show me where the index couple was exposed"). Often coincides with the first stop but not always (e.g., `MVH-001` likely got infected at the Ushuaia birdwatching site, which is stop 2 if we record their NL departure as stop 1).
- **`context`:** free-form string describing what they were doing — `'birdwatching expedition'`, `'MV Hondius port call'`, `'hospital admission'`, `'home isolation'`. The dashboard renders these as tooltips on the travel-path line.
- **Composite index `(case_id, arrived_at)`:** matches the hot query — "fetch this case's stops in chronological order."

### RLS

```sql
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY cases_public_read ON cases FOR SELECT USING (true);

ALTER TABLE case_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY case_locations_public_read ON case_locations FOR SELECT USING (true);
```

Mirrors existing tables: anon can SELECT, all writes require service role.

### Realtime publication

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE cases;
ALTER PUBLICATION supabase_realtime ADD TABLE case_locations;
```

Both INSERT + UPDATE flow to subscribers. Cases UPDATE matters because pipeline transitions status (`suspected` → `confirmed` → `deceased`) and the dashboard should reflect that without refresh.

## Seed data

Append `supabase/seed.sql` with `INSERT INTO cases ...` and `INSERT INTO case_locations ...` blocks. Ten cases:

| code | status | role | exposure | path |
|---|---|---|---|---|
| MVH-001 | deceased | passenger | rodent_contact (Ushuaia) | NL → AR → CL → AR → MV Hondius → NL† |
| MVH-002 | deceased | passenger | person_to_person (partner of MVH-001) | NL → AR → CL → AR → MV Hondius → NL† |
| MVH-003 | confirmed | passenger | person_to_person (close-contact passenger) | various NL/DE → MV Hondius → CV (anchored) |
| MVH-004 | confirmed | crew | person_to_person (cabin steward) | various → MV Hondius → CV |
| MVH-005 | suspected | passenger | unknown | various → MV Hondius → US (CA, home isolation) |
| MVH-006 | suspected | passenger | unknown | various → MV Hondius → US (GA, home isolation) |
| MVH-007 | suspected | passenger | unknown | various → MV Hondius → US (AZ, home isolation) |
| MVH-008 | critical | passenger | person_to_person | MV Hondius → CV (hospital, Praia) |
| CH-001 | confirmed | contact | person_to_person (intimate partner of MVH-009 returnee) | CH (Zurich, hospital admission) |
| MVH-009 | suspected | passenger | unknown | various → MV Hondius → CH (Zurich; CH-001 is their partner) |

Each case_locations row has lat/lng (approximate, public info — Ushuaia, Praia, Zurich, etc.). Each case has a 2–4 paragraph `dossier` written in journalistic-summary style.

`source_event_id` for each case is set to a representative existing seed event (e.g., MVH-001/002 → "Dutch index couple obituary" event, CH-001 → "Switzerland confirms first secondary case").

## Files added

```
supabase/
├── migrations/
│   └── 20260508000000_cases_schema.sql      # NEW: DDL above
├── seed.sql                                  # MODIFY: append cases + case_locations
└── tests/database/
    ├── 07_cases.test.sql                    # NEW: cases table structure
    ├── 08_case_locations.test.sql           # NEW: case_locations structure
    ├── 05_rls.test.sql                      # MODIFY: + cases / case_locations RLS asserts
    └── 06_realtime.test.sql                 # MODIFY: + cases / case_locations publication asserts
```

## Testing (pgTAP)

`07_cases.test.sql` — has_table, has_column for all 16 columns, NOT NULL on (created_at, updated_at, case_code, disease, status, is_index_case), CHECK on (status, role, exposure_type, sex), UNIQUE on case_code, FK source_event_id → events(id), all 5 indexes present.

`08_case_locations.test.sql` — has_table, has_column for all 11 columns, NOT NULL on (case_id, country_code, arrived_at, is_exposure_site), FK case_id → cases(id) with ON DELETE CASCADE behavior (insert case + 2 locations, delete case, expect 0 locations), both indexes present.

Extend `05_rls.test.sql` to add 4 assertions: cases RLS enabled, case_locations RLS enabled, anon can SELECT both, anon cannot INSERT either. Bumps plan count from 12 to 16.

Extend `06_realtime.test.sql` to add 2 assertions: cases in `supabase_realtime`, case_locations in `supabase_realtime`. Bumps plan count from 3 to 5.

## Migration & deploy steps

Local:

1. Write migration + tests + seed.
2. `./scripts/reset-db.sh` (drop, reapply, seed).
3. `supabase test db` — all green.
4. `npm run build && npm run lint && npm run typecheck` — frontend still compiles (it doesn't reference the new tables yet, so this is just a no-regression check).

Remote (after local green):

5. `supabase db push` — applies the new migration to `wtatysorlkcteleqjzkm`.
6. Optionally seed remote via Supabase Studio's SQL editor — or wait until 2.6 lands and we seed once.

## Risks and open questions

- **Anonymity:** the case_code → real-person mapping is intentionally NOT in the database. A small operational note in the spec / README warns the pipeline never to write real names. Compliance burden lives with whoever runs the Cowork session.
- **`departed_at = NULL` semantics:** "current location" is "the stop with `departed_at IS NULL` and the latest `arrived_at`." If a case has multiple stops with NULL `departed_at` (data error), UI picks the latest. Pipeline must close out previous stops on insert.
- **`current_country` redundancy:** denormalized for query performance and simplicity. Pipeline maintains it on `cases` UPDATE when it inserts a new `case_locations` row.
- **Real-name leakage in `dossier`:** the LLM that writes dossiers must be instructed to use case_code references. Spec note for sub-project 3.

## Out of scope

- Sub-project 2.6: Ops Console UI rebuild — consumes this schema, not part of this cycle.
- Sub-project 3: Data pipeline — writes to this schema in a future cycle.
- A `case_events` M2M join table — defer until the UI demands it.
- `case_status_history` — defer; UPDATEs are tracked via Realtime if needed.
