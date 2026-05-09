# Pathwatch Pipeline — API Rebuild Design

**Status:** Design approved 2026-05-09. Pending implementation plan.
**Author:** Claude (brainstorming session with john)
**Related:** `docs/runbooks/pipeline.md`, `docs/runbooks/pipeline-operator.md`

---

## Goal

Replace the current Anthropic-hosted Claude scheduled-task ("dispatch session") that runs the Pathwatch pipeline with a Vercel Function that calls the Anthropic API directly via the AI SDK. Same pathogen-tracking behavior, same data outputs, with reliability and visibility we don't have today.

## Why now

The dispatch session has been hitting AUP false positives — Anthropic's safety classifier flagging benign outbreak-monitoring content as policy violations. Cycles fail silently or block mid-run. Audit logs confirm the dispatch session is itself just a Claude API call wrapped in a hosted harness — moving to direct API access does not lose model intelligence and removes the failure mode.

## Non-goals

- Phone control / chat steering. The user confirmed this was a workaround for dispatch unreliability, not a real product requirement.
- Real-time streaming of partial results.
- Multi-tenant / multi-disease parallel pipelines (designed-for, not built now).
- A new dashboard UI. The pipeline writes to existing tables; existing UI consumes them.

---

## 1. Architecture

A single Vercel Function, triggered every 6 hours by Vercel Cron, runs the full Pathwatch pipeline as a Phase-1 / Phase-2 / Phase-3 sequence. It reads from and writes to the existing Supabase project. No queues, no workflow engine, no chat surface.

```
┌────────────────────────────────────────────────────────────────┐
│  Vercel Cron  (0 */6 * * *)                                     │
└────────────────────────────────┬────────────────────────────────┘
                                 │ POST  Authorization: Bearer $CRON_SECRET
                                 ▼
┌────────────────────────────────────────────────────────────────┐
│  /api/cron/pipeline/route.ts                                    │
│  ─────────────────────────────                                  │
│  Phase 1 — Scrape & Process  (Sonnet 4.6 agent loop, ~30 steps)│
│    tools: webSearch, webFetch, supabaseRead, supabaseWrite      │
│    writes: events, cases, case_locations, country_stats,        │
│            facts, case_relationships                            │
│                                                                 │
│  Phase 2 — Threat & Snapshot Analysis  (Opus 4.7 1M, 1 call)    │
│    inputs: Phase 1 delta + 7d events + facts + Polymarket fetch │
│    writes: threat_assessments (always), snapshots (if delta)    │
│                                                                 │
│  Phase 3 — Log  (no model call)                                 │
│    writes: scrape_log row with cycle stats                      │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │  Supabase  (existing tables) │
                  └──────────────────────────────┘
```

**Runtime config:** Vercel Fluid Compute, `maxDuration: 800`, region `iad1`. Cron expression `0 */6 * * *` (UTC).

**Why two model phases:** Phase 1 is high-volume tool use (search, fetch, write). Sonnet is sufficient for "is this a duplicate," "score significance," "geocode," and 5–10× cheaper per token. Phase 2 is low-volume but high-stakes analytical text (assessment narrative, situation brief AI analysis). Opus 4.7 1M is reserved for these so the user-visible analytical text doesn't drift.

**Snapshot write criteria (the "material change" rule):** Phase 2 writes a new `snapshots` row when at least one of the following is true compared to the most recent snapshot — `total_cases` changed, `total_deaths` changed, `countries_affected` changed, `fatality_rate` changed by ≥0.5 pp, OR `key_developments` would have at least one new entry. Otherwise, no snapshot row this cycle (the existing row stays current). `threat_assessments` is always written.

**Why one function, not many:** Mirrors the dispatch session's mental model (one agent loop). Easiest to debug — full execution lives in one function call. ~6 min current wall-clock fits comfortably in the 800s window with margin.

---

## 2. Output coverage map

Every UI surface, the table that feeds it, and the pipeline phase that writes it.

| UI surface | Table → fields | Written by | Frequency |
|---|---|---|---|
| Intelligence feed (event stream) | `events` (all cols) | Phase 1 | Every cycle, only new |
| Watchlist (alerts) | `events` with `significance >= 3` (UI shows `>=4` as ALERT, `==3` as WATCH) | Phase 1 | Every cycle |
| Monitoring feed (cohort) | `cases` WHERE `status='monitoring'` + `clearance_date` countdown | Phase 1 | Add new persons; clear when `clearance_date < today` |
| Map markers | `country_stats` (`status`, `cases`, `deaths`) | Phase 1 | Every cycle |
| By Country table | `country_stats` (full row) | Phase 1 | Every cycle |
| Countries Affected list (severity-sorted) | `country_stats` — sorted in UI | Phase 1 | Every cycle |
| Case dossier | `cases.dossier`, `display_name`, demographics, key dates | Phase 1 | Updated when new info per case |
| Travel timeline (Palantir trace) | `case_locations` rows + new transit fields | Phase 1 | Append rows as movements reported |
| Pandemic Probability number | `threat_assessments.pandemic_probability` + `threat_level` | Phase 2 | Every cycle |
| VS Market delta | `threat_assessments.polymarket_pandemic_odds` | Phase 2 | Every cycle |
| Risk badge (top right) | `threat_assessments.threat_level` ordinal | Phase 2 | Every cycle |
| Key metrics badges (R0, MUTATIONS, SAR, CONTAINMENT) | `threat_assessments.{r0_estimate, mutation_status, secondary_attack_rate, containment_effectiveness}` | Phase 2 | Every cycle |
| Assessment narrative | `threat_assessments.summary` + `reasoning` | Phase 2 | Every cycle |
| Triggers watching/tripped | `threat_assessments.triggers_watching` / `triggers_tripped` | Phase 2 | Every cycle |
| Situation Brief | `snapshots.ai_analysis` + headline derived from `key_developments` | Phase 2 | When material change (see below) |
| Snapshot totals | `snapshots.{total_cases, total_deaths, countries_affected}` | Phase 2 | Same row as situation brief; written together |
| Virus Profile | `facts` filtered by `category IN ('pathogen','transmission','clinical')` | Phase 1 (fact corroboration) | When new fact corroborated |
| scrape_log (operator-only) | `scrape_log` (full row + new columns) | Phase 3 | Every cycle |

---

## 3. Schema deltas

Four migrations ship with the pipeline rebuild.

### Migration A — `case_locations` transit fields

```sql
-- supabase/migrations/20260509120000_case_locations_transit.sql
ALTER TABLE case_locations
  ADD COLUMN transit_mode TEXT
    CHECK (transit_mode IN ('flight','ship','land','unknown')),
  ADD COLUMN transit_id TEXT,
  ADD COLUMN transit_origin_code TEXT,
  ADD COLUMN transit_destination_code TEXT;

CREATE INDEX idx_case_locations_transit
  ON case_locations (transit_id)
  WHERE transit_id IS NOT NULL;
```

Enables the Palantir-style trace to label each segment with its flight/vessel ID, find shared-flight clusters, and tooltip transit details.

### Migration B — `case_relationships` (transmission graph)

```sql
-- supabase/migrations/20260509130000_case_relationships.sql
CREATE TABLE case_relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  disease TEXT DEFAULT 'hantavirus' NOT NULL,
  source_case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  target_case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL
    CHECK (relationship_type IN ('infected_by','co_exposed','contact')),
  confidence DOUBLE PRECISION CHECK (confidence BETWEEN 0 AND 1),
  evidence_event_id UUID REFERENCES events(id),
  notes TEXT,
  CHECK (source_case_id <> target_case_id),
  UNIQUE (source_case_id, target_case_id, relationship_type)
);

CREATE INDEX idx_case_rel_target ON case_relationships (target_case_id);
CREATE INDEX idx_case_rel_source ON case_relationships (source_case_id);
CREATE INDEX idx_case_rel_disease ON case_relationships (disease);

ALTER TABLE case_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY case_relationships_public_read
  ON case_relationships FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE case_relationships;
```

Phase 2 reads this graph as input when computing `r0_estimate` — assessment becomes data-derived rather than narrative-derived. Future: cluster visualization, contact-trace depth metric.

If a case has no known source, no row is inserted. Edges only when the link is reported.

### Migration C — `scrape_log` extended columns

```sql
-- supabase/migrations/20260509140000_scrape_log_metrics.sql
ALTER TABLE scrape_log
  ADD COLUMN cases_created INTEGER DEFAULT 0,
  ADD COLUMN facts_created INTEGER DEFAULT 0,
  ADD COLUMN relationships_created INTEGER DEFAULT 0,
  ADD COLUMN threat_written BOOLEAN DEFAULT false,
  ADD COLUMN snapshot_written BOOLEAN DEFAULT false,
  ADD COLUMN error_phase TEXT
    CHECK (error_phase IN ('scrape','analyze','log')),
  ADD COLUMN total_cost_usd DOUBLE PRECISION;
```

`scrape_log` is the operator's sole window into pipeline health — without these columns it can't answer "did this cycle succeed" or "what's it costing me."

### Migration D — `case_locations` idempotency

```sql
-- supabase/migrations/20260509150000_case_locations_unique.sql
ALTER TABLE case_locations
  ADD CONSTRAINT case_locations_unique_stop
  UNIQUE NULLS NOT DISTINCT (case_id, arrived_at, transit_id);
```

Prevents duplicate stops if a cycle re-runs the same prompt. `transit_id` participates so two real flights from the same airport on the same day stay distinct.

### Tag convention — sequencing (no schema change)

Pipeline writes `events.tags` with consistent prefixes when a sequencing report is observed:

```
['sequencing', 'lab:swiss-tph', 'lineage:andv-classic', 'mutations:none']
['sequencing', 'lab:cdc-atlanta', 'lineage:andv-2026a', 'mutations:gp-h152y']
```

Plus a `facts` row with `category='pathogen'`. When a sequencing-focused UI is built later, migration reads tags into a structured table — no data lost.

### Disease-agnostic discipline (no schema change)

Every prompt template, SQL query, and config object takes `disease` as input. Default `'hantavirus'`. Cron passes the disease as a query param:

```json
{
  "crons": [
    { "path": "/api/cron/pipeline?disease=hantavirus", "schedule": "0 */6 * * *" }
  ]
}
```

Adding a second outbreak = adding a second cron line. No code change.

---

## 4. Components

```
app/
└── api/
    └── cron/
        └── pipeline/
            └── route.ts              # entry: verify cron secret, call runPipeline, return JSON

lib/
├── pipeline/
│   ├── index.ts                      # runPipeline(disease) orchestrator
│   ├── auth.ts                       # verifyCronSecret(request)
│   ├── phase1-scrape.ts              # Sonnet agent loop
│   ├── phase2-analyze.ts             # Opus single call → threat + snapshot
│   ├── phase3-log.ts                 # writes scrape_log
│   ├── polymarket.ts                 # non-AI fetch of pandemic odds
│   ├── types.ts                      # PipelineDelta, Analysis, ToolResult
│   ├── tools/
│   │   ├── index.ts                  # tool registry exported to AI SDK
│   │   ├── web-search.ts             # Anthropic web_search_20250305 server tool
│   │   ├── web-fetch.ts              # plain fetch() wrapper, 15s timeout, 1MB cap
│   │   ├── events.ts                 # readRecentEvents / writeEvent / dedupCheck
│   │   ├── cases.ts                  # readMonitoringCases / writeCase / writeCaseLocation
│   │   ├── relationships.ts          # writeCaseRelationship
│   │   ├── country-stats.ts          # syncCountryStats
│   │   └── facts.ts                  # readFacts / writeFact / updateFact
│   └── prompts/
│       ├── phase1-system.md          # Sonnet agent's system prompt (versioned in git)
│       └── phase2-system.md          # Opus analyzer's system prompt
└── supabase-admin.ts                 # service-role client for writes (distinct from supabase-server.ts)

supabase/migrations/
├── 20260509120000_case_locations_transit.sql
├── 20260509130000_case_relationships.sql
├── 20260509140000_scrape_log_metrics.sql
└── 20260509150000_case_locations_unique.sql

vercel.json                            # adds crons entry
```

### Boundary table

| File | Single purpose | Depends on |
|---|---|---|
| `route.ts` | HTTP boundary, auth, error response | `pipeline/index.ts`, `pipeline/auth.ts` |
| `pipeline/index.ts` | Sequence the 3 phases, accumulate metrics | All three phase files |
| `phase1-scrape.ts` | One AI SDK `generateText` call with tools | AI SDK, `tools/*`, prompt file |
| `phase2-analyze.ts` | One AI SDK `generateText` call, no tools, structured output via Zod | AI SDK, `polymarket.ts`, prompt file |
| `phase3-log.ts` | `INSERT INTO scrape_log` | `supabase-admin` |
| `tools/*` | One Supabase or HTTP operation per tool | `supabase-admin`, Zod |
| `prompts/*.md` | Versioned prompt text | nothing |

### Implementation choices

1. **AI SDK + Vercel AI Gateway, not the Anthropic SDK directly.** Provider strings (`'anthropic/claude-sonnet-4-6'`, `'anthropic/claude-opus-4-7'`) route through the Gateway for observability, fallback, and a single billing line.

2. **Tools are typed and side-effect-isolated.** Each tool: input Zod schema → DB/HTTP call → typed output. Tools don't reach across each other. Fast to test against a real Supabase.

3. **Prompt caching on Phase 1.** System prompt + tool definitions don't change between cycles. Marking them `cache_control: { type: 'ephemeral' }` cuts input cost ~10× on cache hits — without this, Phase 1 cost balloons because the system prompt is large.

4. **Service-role client for writes only.** `lib/supabase-admin.ts` uses the service-role key; never imported into UI code. All Phase 1/2/3 writes go through it. Existing `supabase-server.ts` and `supabase-browser.ts` (anon key) remain untouched.

5. **Models: Sonnet 4.6 for Phase 1, Opus 4.7 1M for Phase 2.** User-confirmed. At 4 cycles/day this targets ~$120/month.

---

## 5. Error handling & reliability

**Principle:** partial cycles are still valuable cycles. We keep what was written, log the failure, and the dashboard surfaces staleness rather than rolling back.

### Failure modes

| Failure | Handling | Recovery |
|---|---|---|
| Tool call hangs (slow site) | 15s timeout + 1MB response cap on `webFetch`; tool returns `{ ok: false, error: "timeout" }` | Model continues with other sources |
| Bad URL / hallucinated source | Tool returns the error; prompt says *"if you can't reach a source, do not write events from it"* | Worst case: nothing written from that source |
| Phase 1 partial failure | URL-hash unique constraint means re-runs are no-ops; written rows stay; route handler logs `error_phase: 'scrape'` | Phase 2 still runs on whatever made it in |
| Phase 2 fails | No new `threat_assessments` or `snapshots` row this cycle; UI shows stale timestamp; `scrape_log` row written with `error_phase: 'analyze'` | Cron retries in 6h |
| AUP false positive on API | AI SDK surfaces `invalid_request_error`; logged | Same retry loop. Different (rarer) classifier than dispatch |
| Function timeout (>800s) | Vercel kills mid-cycle; tool calls already completed remain in DB; no `scrape_log` row | Detected by absence in dashboard staleness banner |
| Supabase outage | Tool calls fail with PG errors; cycle aborts | Cron retries |
| Source goes down (e.g., WHO RSS 503) | One tool call fails | Routine — model proceeds with remaining sources |

### Idempotency contract

Every write is safe to repeat:

- `events` — URL hash unique constraint
- `cases` — `case_code` unique constraint
- `case_locations` — `(case_id, arrived_at, transit_id)` unique constraint (Migration D)
- `country_stats` — upsert on `(disease, country_code)`
- `facts` — unique on `(disease, title)`, upsert
- `case_relationships` — unique on `(source, target, type)` (Migration B)
- `threat_assessments`, `snapshots` — append-only by design; UI reads `MAX(created_at)`; duplicate runs cost extra rows, not corruption

### Operator visibility

`scrape_log` is the lifeline. Every cycle writes exactly one row in a `try/finally` block:

```ts
{
  source_type: 'pipeline',
  results_found: <Phase1 search hits>,
  events_created, duplicates_skipped,
  cases_created, facts_created, relationships_created,
  threat_written, snapshot_written,
  error: <message or null>,
  error_phase: 'scrape' | 'analyze' | 'log' | null,
  duration_ms: <wall clock>,
  total_cost_usd: <Phase1.cost + Phase2.cost>,
}
```

A dashboard banner reading `MAX(scrape_log.created_at) > 12h ago` surfaces silent multi-day outages. (UI work, separate from this spec; flagged in §7.)

### Cron secret

Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. The route validates before running. Without this, anyone can trigger your full pipeline cost from outside.

---

## 6. Testing

| Layer | Test | Notes |
|---|---|---|
| Tools | Unit, against real Supabase via existing `db:reset` pattern | Each tool small + typed; fast to cover |
| Type safety | `npm run typecheck` | Already wired; AI SDK + Zod catches schema drift |
| Phase 2 structured output | Fixture-based, on-demand | Recorded `PipelineDelta` + DB snapshot → Opus call → validate Zod schema + invariants (`probability ∈ [0,1]`, `threat_level` matches probability bucket). One real-call test, run on demand, costs ~$0.50 |
| Migrations | Existing pattern via `db:reset` | Validates clean migration apply |
| End-to-end smoke | Manual `npm run pipeline:smoke` | One real cycle against test DB; assert ≥1 events row, scrape_log row with no error, threat + snapshot written. Hits real Anthropic API (~$1). Run before deploys. |

**Not tested:**
- Phase 1 agent behavior — non-deterministic, low-value to assert
- Web search results — same reason
- Mocked LLM behavior — passes while real model differs; negative ROI

**Cost & quality monitoring (post-launch):** chart `scrape_log.total_cost_usd` over time. A 3× cost spike means the model is looping or fact-checking too aggressively — investigate via the cycle's audit logs.

---

## 7. Decisions log

| Decision | Choice | Why |
|---|---|---|
| Cadence | Every 6 hours, fixed | User chose; eliminates need for adaptive logic |
| Phone control | None | User confirmed it was a workaround for dispatch unreliability |
| Scope | Match full runbook (events + facts + threat + snapshots + cases + relationships) | User chose over SKILL.md-only or phased |
| Models | Sonnet 4.6 (Phase 1) + Opus 4.7 1M (Phase 2) | Quality on user-visible analytical text; cheaper routine work |
| Architecture | Single Vercel Function, Fluid Compute | Mirrors dispatch mental model; 6-min cycles fit 800s timeout |
| Workflow engine? | No (rejected WDK) | Overkill for 4 cycles/day on a single pipeline |
| Multi-stage split? | No (rejected option B) | Simpler is better; split mechanically if cycles grow past 12 min |
| Provider integration | AI SDK via Vercel AI Gateway | Vercel-native, observability, single billing |
| Schema additions | All four (transit fields, relationships, scrape_log metrics, locations dedup) | All directly serve virus-tracking quality |
| Sequencing data | Tag convention (no table) | YAGNI until a sequencing UI exists |
| Disease parameterization | Always | Cheap up-front, painful to retrofit |

---

## 8. Out of scope (flagged for future work)

- **Stale-pipeline dashboard banner** — UI work to surface `MAX(scrape_log.created_at) > 12h`. Tiny task, separate PR. Without it a silent outage is invisible.
- **Sequencing structured table** — promote tag convention to schema once a sequencing UI is needed.
- **Cluster visualization** — `case_relationships` enables a graph view; no UI for it yet.
- **Multi-disease parallel pipelines** — design supports it; no second disease today.
- **Cost budget alerts** — chart cost; alert when daily total exceeds threshold. Nice-to-have, not blocking.
- **Surge mode** — fixed 6h cadence today. If outbreak escalates, add a manual trigger or adaptive cadence then.

---

## Appendix — Cost model

Per cycle, with prompt caching:

- **Phase 1** (Sonnet 4.6, agent loop, ~30 steps, cached system prompt): ~$0.50
- **Phase 2** (Opus 4.7 1M, single call, ~50k input + 5k output): ~$0.50
- **Polymarket fetch + scrape_log write:** ~$0

**Per cycle total:** ~$1.00
**At 4 cycles/day:** ~$120/month

Compare to dispatch session today: ~$2.35/cycle × 48 cycles/day = ~$3,400/month bundled in subscription. Rebuild reduces total spend ~30× because of the cadence drop, with a modest quality tradeoff (Sonnet for routine work) we judged acceptable.

`scrape_log.total_cost_usd` is the truth source. Watch the first week of production data and tune model assignments if needed.
