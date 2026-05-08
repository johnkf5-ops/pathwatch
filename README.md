# Pathwatch

Real-time disease outbreak tracker. V1 covers the 2026 MV Hondius hantavirus
outbreak (Andes orthohantavirus / ANDV).

The dashboard is a Next.js 14 App Router app reading from Supabase via the anon
key, with realtime subscriptions for live updates. Schema, dashboard core,
map + charts, and event detail pages are all on `main`.

## Prerequisites

- Docker provider, running (Docker Desktop, Colima, or equivalent)
- Node ≥ 20: `node --version`
- Supabase CLI: `brew install supabase/tap/supabase-beta` (macOS)
- PostgreSQL client tools (`psql`): `brew install libpq`

## Local setup

```bash
supabase start              # spin up local stack
./scripts/reset-db.sh       # apply migrations + run seed.sql
npm install                 # one-time: install Node deps
cp .env.example .env.local  # then paste anon/publishable key from `supabase status`
npm run dev                 # http://localhost:3000
```

Local URLs printed by `supabase start`:
- Postgres:  `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- API:       `http://127.0.0.1:54321`
- Studio:    `http://127.0.0.1:54323`

## Development workflow

```bash
npm run dev          # Next.js dev server
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run build        # production build
npm run test:smoke   # reset DB + run Playwright smoke specs
supabase test db     # run pgTAP tests in supabase/tests/database/
```

When you change the migration, re-run `./scripts/reset-db.sh` to drop and
reapply it. pgTAP tests run inside transactions and roll back, so they don't
pollute the seeded dataset.

## Schema overview

Seven tables across three migrations:

- `events` — atomic intelligence units with URL-hash dedup, CHECK-constraint
  enums, and a partial index on the dashboard's hot read path.
- `snapshots` — append-only situation rollups (LLM-generated narrative + aggregates).
- `country_stats` — per-country state with `UNIQUE(disease, country_code)` for upsert.
- `scrape_log` — pipeline observability, RLS-locked from anon.
- `cases` + `case_locations` — individual infected persons (anonymized via
  `case_code` like `MVH-001`) and their travel timelines.
- `facts` — verified knowledge base; entries written by the pipeline with
  `verification_status`, `confidence`, source attribution.

RLS lets the anon key SELECT from all tables except `scrape_log`; all writes
require the service role. `scrape_log` is service-role-only.

## Pipeline runbook

The Cowork session that operates the data pipeline reads
`docs/runbooks/pipeline.md` at session start. That document codifies the
scrape → dedupe → fact-check → write cycle, source credibility tiers,
confidence-scoring rubric, and error handling.

## Notes for non-Docker-Desktop setups

If you use Colima or another Docker alternative, the analytics service is
already disabled in `supabase/config.toml` because the `supabase_vector`
container fails to mount the Docker socket on virtiofs. Re-enable only if
your Docker provider supports unix-socket bind-mounts.

## Design

Specs and plans for each sub-project live under `docs/superpowers/`.

## Production deploy

Deploy is GitHub-driven: push to `main` triggers a Vercel build. One-time setup:

1. **Provision a Supabase project.** Sign in at supabase.com → "New project". Note the project ref (the part before `.supabase.co`), the API URL, and the publishable (anon) key from the API settings page.

2. **Apply the migration to the prod project.** From this repo:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

3. **Optionally seed prod.** Open the prod project's Studio (Supabase web UI) → SQL editor → paste the contents of `supabase/seed.sql` → run. Skip if you want production to start empty (the data pipeline in sub-project 3 will fill it).

4. **Authenticate `gh` and `vercel` locally** (one-time):
   ```bash
   gh auth login -h github.com -w
   vercel login
   ```

5. **Create the GitHub repo and push:**
   ```bash
   gh repo create pathwatch --public --source=. --push
   ```

6. **Link this directory to a Vercel project:**
   ```bash
   vercel link
   ```
   Accept the defaults (link to current directory, framework: Next.js detected).

7. **Set env vars in the Vercel project.** Either via CLI or the project's Settings → Environment Variables UI. Production scope:
   - `NEXT_PUBLIC_SUPABASE_URL` — value from step 1
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — value from step 1

8. **Trigger the first production deploy:**
   ```bash
   vercel --prod
   ```

After this, every push to `main` auto-deploys. Branch pushes get preview deployments.
