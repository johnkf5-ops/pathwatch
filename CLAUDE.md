# Pathwatch — Claude project guide

Real-time outbreak tracker for the 2026 MV Hondius hantavirus / ANDV cluster.
Production: https://pathwatch-phi.vercel.app and https://hantavirustracer.com (auto-deploy from `main`).

## Fresh session — pick a workflow

When the user opens a session in this repo without a specific task, ask which workflow they want to run:

> *"Do you want to run a pipeline cycle, update case dossiers, or work on something else?"*

Then follow the relevant runbook:

| Workflow | What it does | Read this |
|---|---|---|
| **Run a pipeline cycle** | Scrape sources → write new events / cases / country_stats / snapshots / threat_assessments. Active mode every 15–30 min. | `docs/runbooks/pipeline-operator.md` (operator setup) then `docs/runbooks/pipeline.md` (agent runbook). Execute one cycle. |
| **Update case dossiers** | Research existing cases for fresh public reporting, append `[Updated YYYY-MM-DD]` blocks with sources, surface correction flags for operator review. | `docs/runbooks/case-dossier-update.md`. Phase 1 dispatches parallel research agents; Phase 2 triages structured corrections with operator confirmation. |
| **General build / feature work** | Code changes, schema migrations, UI work, etc. | No specific runbook — read the rest of this file for project context, then proceed normally. |

If the user opens with a specific task that fits one of the above, jump straight to the relevant runbook. If unclear, ask.

## Stack

- **Next.js 14 App Router** (TypeScript, strict mode)
- **Supabase** (Postgres + Realtime + RLS) — remote project `wtatysorlkcteleqjzkm.supabase.co`
- **MapLibre + deck.gl** (CARTO Dark Matter basemap, animated `TripsLayer` over a static `PathLayer` for case traces)
- **Tailwind CSS** with the existing intel-terminal palette in `tailwind.config.ts`
- **Vercel** — hosting, cron, AI Gateway available

Local dev: `npm run dev` (hits local Supabase via `.env.local`). Smoke: `npm run test:smoke` (Playwright).

## Layout overview

Desktop (≥ 1024px) is a three-column flight deck. Mobile is a vertical stack rendered by `components/ops/MobileLayout.tsx`.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TopBar  (h-9, slim) · pandemic-prob chip · LIVE · X VIEWING · X TOTAL · │
│                                              · UTC · RISK · DESKTOP nag │
├──────────────────┬──────────────────────────────┬───────────────────────┤
│ Sit-rep brief    │   TabStrip (MAP / BY COUNTRY)│ Watchlist             │
│ ThreatPanelExp.  │                              │ MonitoringCohort      │
│ (narrative +     │   MAP                        │ PostureMatrix         │
│  KEY SIGNALS +   │   + KPI HUD overlay          │  (Countries Affected) │
│  Polymarket)     │   + DossierDrawer overlay    │                       │
│ VirusProfile     │                              │                       │
├──────────────────┴──────────────────────────────┴───────────────────────┤
│ EventFeed — horizontal ticker (320px cards, scrolls →)                  │
└─────────────────────────────────────────────────────────────────────────┘
```

Grid: `lg:grid-cols-[540px_1fr_300px] lg:grid-rows-[1fr_180px]`. Each panel has `overflow-y-auto` on its grid item — same scroll pattern across all of them.

## Key components and where they live

| Path | Purpose |
|---|---|
| `app/DashboardClient.tsx` | The desktop+mobile orchestrator with the grid layout and Realtime subscriptions |
| `components/ops/TopBar.tsx` | Slim header — branding, LIVE pulse, threat indicator chip, VisitorStats, UTC, risk |
| `components/ops/SituationBrief.tsx` | Three-tier sit-rep: `snapshots.headline` (one line) + `snapshots.ai_analysis` (narrative prose, 2-4 paragraphs) + `snapshots.key_developments` (bullet facts) |
| `components/ops/OutbreakTimeline.tsx` | Day-by-day chronology rail (left column under SituationBrief). Reads `outbreak_timeline` table; one row per day with a short snippet; latest day highlighted green |
| `components/threat/ThreatPanelExpanded.tsx` | Always-visible assessment narrative + reasoning + signals + Polymarket |
| `components/profile/VirusProfile.tsx` | 4×3 KPI grid driven by `key:*`-tagged facts |
| `components/ops/Watchlist.tsx` | Right-column alerts feed (filtered events, sig ≥ 3) |
| `components/ops/MonitoringCohort.tsx` | Right-column list of `cases.status='monitoring'` with clearance countdown |
| `components/ops/PostureMatrix.tsx` | Compact Countries Affected list (sorted by deaths/cases/status) |
| `components/ops/MapPane.tsx` → `components/map/MapPanel.tsx` | MapLibre + deck.gl, including animated trips trace |
| `components/ops/KpiHud.tsx` | Collapsible glass HUD top-right of the map |
| `components/ops/DossierDrawer.tsx` | Fixed-position right-side panel; slides in over the EventFeed strip; renders full CaseDossier inside |
| `components/case/CaseDossier.tsx` | Full case detail (header + dossier + key dates + travel timeline + linked event) |
| `components/feed/EventFeed.tsx` | **Horizontal ticker** of 320px cards with filter tabs |
| `components/ops/VisitorStats.tsx` | Live presence + cumulative `visitor_log` count chips |
| `components/ops/MobileLayout.tsx` | Vertical-stack mobile layout. Gates `CaseDossierSheet` behind `useMediaQuery` |
| `components/case/CaseDossierSheet.tsx` | Mobile bottom-sheet (vaul) — **must only mount on mobile** (see Gotchas) |
| `lib/use-media-query.ts` | SSR-safe useMediaQuery hook used to gate mobile-only mounts |
| `lib/threat-triggers.ts` | Pandemic probability → threat level bucket mapping + UI tokens |
| `lib/case-helpers.ts` | `caseLabel`, `caseLocationsFor`, `currentLocation`, `statusRgb`, `STATUS_COLOR` |

## Data layer

Tables in production Supabase, all with public-read RLS:
- `events` — scraped news/intelligence items
- `cases` + `case_locations` — outbreak cases and their travel timeline. **`cases.case_class`** disambiguates `confirmed_case` / `probable_case` / `suspected_case` / `contact` / `returnee` from the lifecycle `status` field.
  - **Cases bucket** (drives the dashboard CASES count + the `country_stats.cases` per-country tally + map orange/red): only `confirmed_case` and `probable_case`. Lab confirmation or strong epi link required.
  - **Suspected bucket**: `suspected_case` rows count toward MONITORING in their `current_country` until they confirm or clear. The country shows teal, not orange.
  - **Contacts bucket**: `contact` and `returnee` count toward "contacts" only — never toward cases regardless of confirmation.
- `country_stats` — per-country case/death totals + status. **Location-based**: `cases` and `deaths` derive from `cases.current_country` (where the patient physically is), not nationality. Map color rule: `deaths > 0` → red, `cases > 0` → orange (where `cases` = confirmed + probable only), `status='monitoring'` with no cases/deaths → teal (this is where suspected-only countries land), nothing → no color. See `docs/runbooks/pipeline.md` "Country attribution: location-based counts" for the recount SQL and conventions. The `cases.nationality` column exists as metadata but does not drive country_stats.
- `snapshots` — outbreak snapshots (totals + ai_analysis paragraph + key_developments + `total_contacts` for the contacts-and-returnees count).
- `threat_assessments` — pandemic_probability + threat_level + reasoning + Polymarket comparison + triggers
- `facts` — verified facts with `key:*`-tagged subset surfaced in VirusProfile
- `scrape_log` — per-cycle observability for the pipeline
- `visitor_log` — unique visitors keyed by localStorage UUID; public read + insert; realtime publication for live count updates

Migrations live in `supabase/migrations/`. Use `npm run db:reset` to reapply locally (Colima/Docker required). Apply to remote with `supabase db push --linked`.

**Migrations applied to remote prod:**
- `20260509160000_visitor_log` (live + cumulative visitor counters)
- `20260509170000`–`20260509170400` (case_class enum: column + backfill + country recount + snapshots.total_contacts + NOT NULL)

**Migrations sitting unapplied** (will ship with the pipeline rebuild): `20260509120000` (case_locations transit fields), `20260509130000` (case_relationships), `20260509140000` (scrape_log metrics), `20260509150000` (case_locations dedup).

## Pipeline (data ingestion)

Pathwatch's case/event data is written by a **separate Claude session**, not by the Next.js app. The runbook for that session is `docs/runbooks/pipeline.md` (agent-facing) plus `docs/runbooks/pipeline-operator.md` (human operator-facing).

### Current state

The Anthropic-hosted scheduled task that previously drove the pipeline (SKILL.md-based) hits AUP false positives intermittently — outbreak terminology accumulates in session context and trips the safety classifier. Currently disabled. Manual cycles are run by opening a **fresh Claude Code session** in this repo and pasting the operator prompt; the session uses `supabase db query --linked` for all writes (no service-role key needed).

### What's next — the API rebuild (designed, not yet implemented)

A complete replacement is specced and planned but not implemented. When the user wants pipeline reliability:

- **Spec:** `docs/superpowers/specs/2026-05-09-pipeline-api-rebuild-design.md` (389 lines — full output coverage map, 4 schema migrations, Sonnet 4.6 Phase 1 agent loop + Opus 4.7 1M Phase 2 structured output, Vercel Cron every 6h, ~$120/mo at chosen cadence)
- **Plan:** `docs/superpowers/plans/2026-05-09-pipeline-api-rebuild.md` (28 TDD tasks, each with file paths + exact code + commit message)
- **How to execute:** invoke `superpowers:executing-plans` skill (or the subagent-driven variant) with the plan file. Each task is self-contained and TDD-shaped. Tasks 4–7 ship the four pending migrations (`20260509120000_case_locations_transit`, `20260509130000_case_relationships`, `20260509140000_scrape_log_metrics`, `20260509150000_case_locations_unique`) — those migration files already exist in `supabase/migrations/`.
- **Cutover:** Task 28 includes verification that the local SKILL-based scheduled task stays disabled so both pipelines don't run in parallel.

The rebuild does not need to ship before any other work — the manual-session cycles keep data flowing. But when the user asks for pipeline reliability or surfaces "the pipeline broke again," the answer is "execute the plan."

### Rule: status is pipeline-owned

Dossier text and most structured fields can be added by ad-hoc research, but **`cases.status` changes are owned by the pipeline only** — research never overwrites case status. Flag conflicts inline as "POSSIBLE CORRECTION" or "POSSIBLE REJECTION" footnotes in the dossier for pipeline review. The pipeline picks them up on its next cycle and decides whether to revise.

### Updating dossiers via research (parallel-agent playbook)

The full step-by-step pattern is documented in `docs/runbooks/case-dossier-update.md`. Summary: pull current case state, identify gaps, dispatch ~20 parallel general-purpose research agents (one per named case + one per anonymized cohort) with strict JSON output, build per-case `UPDATE` SQL appending to `dossier`, apply via `supabase db query --linked`, verify, surface the diff to the operator.

Privacy rules baked into that playbook: demographics as ranges only, no real names on anonymized passengers, status never changed from research, sources cited inline in every dossier addition.

## Conventions

- **Sources cited in every dossier addition** — multi-source URLs at the end of any new prose written into `cases.dossier`.
- **Demographics as ranges, not exact** — `age_range: '60-69'`, never `'67'` (even when reported). Display name can keep the exact age (e.g., "Spanish Woman, 32"); `age_range` is a separate field.
- **No real names in anonymized cases** — US passengers stay "Texas Resident #1" even if reporting reveals identities.
- **`key:*` tag SHORT form** — `key:vaccine` not `key:vaccine_status`. Matches the parallel pipeline session's convention; deviating causes silent-empty VirusProfile tiles.
- **`router.replace({ scroll: false })`** on every case/country selection — Next.js otherwise scrolls the page to top, hiding the TopBar.
- **No timelines or speed words** — see `feedback_quality_over_effort.md` in user memory.

## Gotchas (the hard-won ones)

### Radix `DismissableLayer` body pointer-events lock

vaul (and any Radix-modal-based component) sets `document.body.style.pointerEvents = 'none'` when open. CSS-only hiding via `lg:hidden` does **not** prevent the React component from mounting — it still mounts, runs effects, and locks the page. **Always gate mobile-only modals/drawers behind `useMediaQuery`**, not just CSS.

In this repo, the `CaseDossierSheet` (vaul) is mounted only when `useMediaQuery('(max-width: 1023.98px)')` is true. **Don't break that gate** — clicks on the entire desktop dashboard die instantly when this regresses.

Diagnose by checking `getComputedStyle(document.body).pointerEvents` in DevTools console.

### Position-fixed elements + flex/grid height inheritance

A `position: fixed` element with `overflow-y: auto`/`scroll` only scrolls if its content exceeds its computed height. Computed height for `inset-y-0` (or `top` + `bottom`) inside an ancestor with `flex-1` doesn't always resolve to a definite value. If scroll doesn't engage when content clearly overflows, set explicit height via inline style (e.g., `style={{ top: '36px', bottom: '0' }}` on the fixed aside).

### `transform` creates a containing block for fixed descendants

If any ancestor of a `position: fixed` element has `transform`, `filter`, or `will-change`, the fixed element is positioned relative to that ancestor instead of the viewport. Watch out when wrapping fixed-positioned overlays inside elements with slide animations.

### MapLibre scroll-zoom captures wheel events

When the cursor is over the map, scroll-wheel zooms the map. Page-level scroll only works when cursor is outside the map. Fixed by making the dashboard a single-viewport layout so page scroll is rarely needed.

### Realtime publication needs explicit `ALTER PUBLICATION`

New tables don't get realtime updates until you explicitly add them to the `supabase_realtime` publication in their migration. See any of the existing migrations for the pattern.

## Developer flow

Smoke before deploys:
```
npm run typecheck
npm run test:smoke
```

Common slow paths:
- Vercel deploys take a couple minutes after a push — hard-refresh the browser (Cmd-Shift-R) before debugging "the fix didn't work."
- Realtime subscriptions sometimes lag on a stale tab. Refreshing forces a fresh fetch.

## When in doubt

Read `docs/superpowers/` for active specs and plans, run `git log --oneline -30` to see what's recent, query `scrape_log` for pipeline cycle history, and read this file end-to-end. Memory at `~/.claude/projects/-Users-claude-Projects-project-contagion/memory/MEMORY.md` has additional cross-session context including user preferences and the pointer-events gotcha above.
