# Pathwatch

Real-time disease outbreak tracker. V1 covers the 2026 MV Hondius hantavirus
outbreak (Andes orthohantavirus / ANDV).

This repo currently contains sub-project 1 of 4: the Supabase database schema.
The frontend dashboard, data pipeline, and snapshot/analysis layer are
separate work cycles.

## Prerequisites

- Docker provider, running (Docker Desktop, Colima, or equivalent)
- Supabase CLI: `brew install supabase/tap/supabase-beta` (macOS)
- PostgreSQL client tools (`psql`): `brew install libpq`

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

## Notes for non-Docker-Desktop setups

If you use Colima or another Docker alternative, the analytics service is
already disabled in `supabase/config.toml` because the supabase_vector
container fails to mount the Docker socket on virtiofs. Re-enable only if
your Docker provider supports unix-socket bind-mounts.

## Design

See `docs/superpowers/specs/2026-05-07-pathwatch-db-schema-design.md`.
