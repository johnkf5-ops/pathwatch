# Pathwatch — Knowledge Base + Pipeline Runbook (Sub-project 3)

**Date:** 2026-05-08
**Sub-project:** 3 — knowledge base + Cowork pipeline runbook
**Status:** Draft, awaiting user review
**Depends on:** sub-projects 1, 2.5, 2.6 (all merged to main; production live at https://pathwatch-phi.vercel.app)
**Source spec:** /Users/claude/Downloads/PATHWATCH_PIPELINE_SPEC.md

## Context

The dashboard is live in production reading from a remote Supabase project that the Cowork session will populate. Two pieces are still missing:

1. **A verified knowledge base** — the `facts` table — that the pipeline cross-references when processing new intel and that the public can read at `/facts` to see what we *actually know* (not just raw event noise).
2. **An operational protocol** — the runbook that future Claude (or human operators) read at session start before driving the pipeline.

This sub-project ships both, plus the small frontend page (`/facts`) that surfaces the knowledge base.

## Goals

1. `facts` table with verification status, confidence scoring, source attribution, and supersession tracking. RLS public-read, Realtime subscribed, append-only by service-role.
2. Seed with 18 verified facts spanning all 8 categories so `/facts` is meaningful on first load.
3. `/facts` page filterable by category and verification status, full-text search across title + content, sorted by confidence within category.
4. Pipeline runbook at `docs/runbooks/pipeline.md` codifying the scrape → dedupe → process → fact-check → write cycle and the source credibility / confidence rubrics from the source spec.
5. TopBar gets a "/facts" nav link.
6. Local pgTAP suite green; Playwright smoke gains one spec for `/facts`; remote Supabase migrated and seeded.

## Non-goals

- Editing facts via the UI (pipeline writes only)
- pgvector / semantic search on `content`
- `/fact/[id]` permalink page (cards on `/facts` show full content)
- Realtime updates on `/facts` (facts change slowly)
- Sub-project 4 — pipeline automation harness (cron, MCP servers, headless agents). Runbook documents the manual protocol; automation comes later.
- Multi-disease support — `disease` column kept for future use, no UI selector yet.

## Schema

```sql
CREATE TABLE facts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  disease TEXT DEFAULT 'hantavirus' NOT NULL,
  category TEXT NOT NULL CHECK (category IN
    ('pathogen','transmission','clinical','epidemiology',
     'containment','history','outbreak_timeline','policy')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','corroborated','confirmed','disputed','retracted')),
  confidence DOUBLE PRECISION CHECK (confidence BETWEEN 0 AND 1),
  sources TEXT[] NOT NULL,
  source_types TEXT[],
  first_reported_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  superseded_by UUID REFERENCES facts(id),
  tags TEXT[],
  UNIQUE (disease, title)
);

CREATE INDEX idx_facts_disease ON facts (disease);
CREATE INDEX idx_facts_category ON facts (category);
CREATE INDEX idx_facts_verification ON facts (verification_status);
CREATE INDEX idx_facts_tags ON facts USING GIN (tags);

ALTER TABLE facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY facts_public_read ON facts FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE facts;
```

Field choices:

- **`category` CHECK** — 8 mutually exclusive values matching the source spec.
- **`verification_status` CHECK** — 5 states; pipeline transitions a fact `unverified` → `corroborated` → `confirmed`. `disputed` flags conflict between credible sources; `retracted` for once-confirmed facts now known wrong.
- **`confidence` DOUBLE 0–1** — nullable so an `unverified` fact can sit without a numeric score until evidence accumulates.
- **`sources` NOT NULL TEXT[]** — empty array is valid only for retracted facts (we keep the title for audit even after taking it down). Pipeline must always populate at least one URL.
- **`source_types` parallel array** — same length as `sources` ideally; values match `events.source_type` enum-by-convention. Loose typing because new source types might appear before the events CHECK is updated.
- **`superseded_by` self-FK** — when a fact is corrected, set `verification_status='retracted'` AND link to the new fact. UI can chain.
- **`UNIQUE (disease, title)`** — title is the human-readable key. Pipeline normalizes titles (lowercase compare) at write time to dedupe.

## Seed data

Append `supabase/seed.sql` with INSERTs for 18 facts across the 8 categories. The 5 the source spec gives verbatim plus 13 more drawn from the MV Hondius evidence base. Examples:

- **pathogen** — "Causative agent identified as Andes orthohantavirus (ANDV)" (confirmed, 0.99) ; "ANDV reservoir is the long-tailed pygmy rice rat (*Oligoryzomys longicaudatus*)" (confirmed, 0.95)
- **transmission** — "ANDV is the only hantavirus with confirmed human-to-human transmission" (confirmed, 0.98) ; "ANDV human-to-human requires close intimate contact, not airborne community spread" (confirmed, 0.95) ; "Rodent-to-human transmission via aerosolized urine/feces in enclosed spaces" (confirmed, 0.95)
- **clinical** — "ANDV case fatality rate is 35-40%" (confirmed, 0.95) ; "Incubation period 7-39 days, median ~18 days" (confirmed, 0.90) ; "No specific antiviral; supportive care including ECMO for severe cases" (confirmed, 0.95) ; "Diagnostic via RT-PCR on serum during acute phase, IgM/IgG serology after" (confirmed, 0.95)
- **epidemiology** — "Primary exposure traced to Ushuaia birdwatching expedition" (confirmed, 0.90) ; "MV Hondius cluster currently 8 confirmed across 5 countries" (corroborated, 0.85) ; "Index dyad MVH-001/MVH-002 are the family cohort triggering the cascade" (confirmed, 0.92)
- **containment** — "Cape Verde refused MV Hondius docking 2026-05-04" (confirmed, 0.97) ; "WHO recommends 42-day surveillance for MV Hondius contacts" (confirmed, 0.90) ; "CDC Level 2 travel advisory active for southern Argentina/Chile" (confirmed, 0.90)
- **history** — "First documented ANDV person-to-person cluster: 1996 El Bolsón, Argentina" (confirmed, 0.95) ; "ANDV first isolated 1995 in southern Chile" (confirmed, 0.95)
- **outbreak_timeline** — "MV Hondius outbreak key dates" (confirmed, 0.95)
- **policy** — "WHO global risk assessment: LOW; CDC US public risk: extremely low" (confirmed, 0.92)

Each fact's `sources` is an array of canonical URLs (WHO DON, CDC, ECDC, Lancet historical study, etc.) and `source_types` parallels with values like `who`, `cdc`, `peer_reviewed`, `news`. `tags` includes strain (`andes-virus`), context (`mv-hondius`), and topic (`transmission`, `cfr`, etc.) where relevant.

## `/facts` page

### Component contracts

```
app/facts/page.tsx              RSC: fetch all facts, hand to FactsClient
components/facts/
├── FactsClient.tsx             URL-driven filter state (?category=, ?verification=, ?q=)
├── FactCard.tsx                title + VerificationBadge + ConfidenceBar + content + sources list + last_verified
├── VerificationBadge.tsx       status-colored mono pill
└── ConfidenceBar.tsx           thin gradient bar (green→amber→red)
```

### `FactsClient` filter rules (client-side derivation)

- `category`: optional, single value, exact match
- `verification`: optional, single value (`confirmed` | `corroborated` | `unverified` | `disputed`), exact match. `retracted` shown only when explicitly selected.
- `q`: case-insensitive substring match against `title || ' ' || content`
- Sort: by category alphabetical, then `confidence DESC NULLS LAST` within category

`URLSearchParams` drive state; `router.replace` updates without scroll.

### `FactCard` layout

```
┌──────────────────────────────────────────────────────────────┐
│ <category>  [VerificationBadge]                              │
│                                                              │
│ Title goes here in mono 16px bold                            │
│                                                              │
│ Content — 1-3 paragraphs in sans 13px text-text-secondary.   │
│                                                              │
│ ▰▰▰▰▰▰▰▰▱▱  92%   confidence bar                            │
│                                                              │
│ Sources: [WHO DON] [CDC] [Lancet 1997] (clickable)           │
│ Last verified: 2026-05-07                                    │
└──────────────────────────────────────────────────────────────┘
```

### `VerificationBadge` colors

| status | color | classes |
|---|---|---|
| confirmed | green | `border-green text-green` |
| corroborated | cyan | `border-cyan text-cyan` |
| unverified | muted | `border-border-strong text-text-muted` |
| disputed | orange | `border-orange text-orange` |
| retracted | red, line-through | `border-red text-red line-through` |

### `ConfidenceBar`

Thin (3px) horizontal bar. `confidence` 0–1 maps to width % and a single color from the gradient: `< 0.5` red, `0.5–0.74` amber, `≥ 0.75` green. NULL → bar is empty + label reads "—".

## Nav update

`TopBar.tsx` gains a `/facts` link in the LIVE-pulse area: `<Link href="/facts">FACTS</Link>` styled as `font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-secondary hover:text-text`. Active route gets `text-text border-b-2 border-green`.

## Pipeline runbook

Saved at `docs/runbooks/pipeline.md`. Markdown only — no code changes. It is the operational reference future Claude reads at the start of a Cowork session.

Sections (mirroring the source spec's pipeline operations):

1. **What you are** — one paragraph framing: Claude IS the pipeline; runs from a Cowork session on the Mac mini.
2. **Connection** — Supabase URL, where the service-role key lives (Settings → API Keys), reminder NOT to commit it.
3. **Cycle cadence** — 15-30 min active, 60 min off-hours, 5-10 min during surges (new country, WHO statement, etc.).
4. **Per-cycle ops** — five steps:
   - Scrape: X (Chrome MCP), CDC RSS, WHO DON, Google News, Reddit, BlueSky. Exact endpoints + queries.
   - Dedupe: URL-hash exact match (DB enforces), semantic against last 48h.
   - Process: classify category, extract case/death counts, geocode, score significance 1–5.
   - Fact-check: compare claims against `facts` table per the verification flowchart from the source spec.
   - Write: INSERT events, UPDATE/UPSERT cases + case_locations + country_stats, periodically INSERT snapshot, log to scrape_log.
5. **Source credibility tiers** — Tier 1 (WHO/CDC/peer-reviewed) → Tier 4 (Reddit/social).
6. **Confidence scoring** — the 0.30→1.0 rubric from the spec.
7. **Fact maintenance** — every 6–12h, walk through the unverified/corroborated upgrade checks.
8. **PII rule** — never write real names; use case_code references; anonymize summaries.
9. **Dossier append format** — `[Updated YYYY-MM-DD HH:MM UTC] ...`
10. **Snapshot AI analysis style** — concise, factual, forward-looking; brief like a decision-maker briefing.
11. **Error handling** — source unreachable → log scrape_log, continue. X rate-limit → 30-min back-off. Supabase write fails → retry once. Chrome disconnected → fall back to non-X sources, alert user.
12. **Surge triggers** — new country reports a case → switch to 5-10 min cycle; WHO press conference or DON update → snapshot immediately.

## Deliverable shape

```
project_contagion/
├── supabase/
│   ├── migrations/
│   │   └── 20260508120000_facts_schema.sql      NEW
│   ├── seed.sql                                  MODIFY (+ facts inserts)
│   └── tests/database/
│       ├── 09_facts.test.sql                     NEW
│       ├── 05_rls.test.sql                       MODIFY (+ facts assertions)
│       └── 06_realtime.test.sql                  MODIFY (+ facts assertion)
├── app/facts/page.tsx                            NEW
├── components/facts/
│   ├── FactsClient.tsx                           NEW
│   ├── FactCard.tsx                              NEW
│   ├── VerificationBadge.tsx                     NEW
│   └── ConfidenceBar.tsx                         NEW
├── lib/types.ts                                  MODIFY (+ Fact interface)
├── components/ops/TopBar.tsx                     MODIFY (+ /facts nav link)
├── tests/dashboard.spec.ts                       MODIFY (+ /facts smoke)
├── docs/runbooks/pipeline.md                     NEW
└── README.md                                     MODIFY (link runbook + facts table mention)
```

## Testing

- `09_facts.test.sql` — has_table, all 14 columns, NOT NULL on (created_at, updated_at, disease, category, title, content, verification_status, sources), UNIQUE(disease, title), CHECK on category + verification_status + confidence, FK superseded_by, all 4 indexes.
- `05_rls.test.sql` — extend: RLS enabled on facts, anon can SELECT, anon cannot INSERT.
- `06_realtime.test.sql` — extend: facts in `supabase_realtime` publication.
- `tests/dashboard.spec.ts` — new spec `/facts renders the knowledge base`:
  - `await page.goto('/facts')`
  - assert "KNOWLEDGE BASE" or "FACTS" heading visible
  - assert at least one `confirmed` VerificationBadge visible
  - assert "Andes orthohantavirus" appears (from the pathogen seed fact)

## Migration & deploy

Local:
1. Write migration + seed extension.
2. `./scripts/reset-db.sh` (drops + reapplies + seeds).
3. `supabase test db` (full pgTAP suite green).
4. `npm run build && npm run lint && npm run typecheck && npm run test:smoke`.

Remote:
5. `supabase db push` — applies new migration to `wtatysorlkcteleqjzkm`.
6. `supabase db query --linked --file supabase/seed.sql` — re-runs full seed (idempotent; ON CONFLICT does the right thing for facts via UNIQUE(disease, title), and other tables already have UNIQUE constraints or our seed only inserts new rows).

Wait — re-running the full seed against remote will fail on duplicate inserts for events / snapshots / country_stats / cases / case_locations because those tables don't have ON CONFLICT clauses in the seed. We need a facts-only seed file OR an ON CONFLICT DO NOTHING strategy.

Cleanest: split into a separate `supabase/seed-facts.sql` and run only that against remote on this cycle. Local `db reset` still runs the full `seed.sql` which now sources the facts seed via `\i seed-facts.sql` at the end.

7. `git push origin main` → Vercel auto-deploys → live at https://pathwatch-phi.vercel.app/facts.

## Risks and open questions

- **Seed re-run on remote.** Addressed by splitting facts seed into a separate file. Local seed sources both; remote run targets only the facts file.
- **Empty `sources` array.** Spec says NOT NULL but allows `[]` for retracted facts. We won't seed any retracted facts in v1, so the constraint holds without specific test coverage.
- **Title collisions across diseases.** UNIQUE is on `(disease, title)` so two diseases can share titles. Fine.
- **`superseded_by` orphaning.** If we delete a fact whose successor is also deleted... not happening in v1; pipeline only INSERTs and UPDATEs.
- **Confidence label rendering.** When NULL, the bar is empty and the label is "—". Acceptable.
- **TopBar layout.** Adding /facts nav link changes the top-bar density. Tested visually at desktop only; mobile may push items to next line — accept for v1.

## Out of scope

- Sub-project 4 — pipeline automation, MCP servers, headless agent runner
- Editing facts via the UI
- Per-fact permalink (`/fact/[id]`)
- pgvector / semantic search of content
- Realtime on the /facts page
- Tags filter UI on /facts
- Multi-disease facts navigation
