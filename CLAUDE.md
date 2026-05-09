# Pathwatch — Claude project guide

Real-time outbreak tracker for the 2026 MV Hondius hantavirus / ANDV cluster.
Production: https://pathwatch-phi.vercel.app and https://hantavirustracer.com (auto-deploy from `main`).

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
| `components/ops/SituationBrief.tsx` | Snapshot key_developments rendered as bullets + ai_analysis paragraph |
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
- `cases` + `case_locations` — outbreak cases and their travel timeline
- `country_stats` — per-country case/death totals + status
- `snapshots` — outbreak snapshots (totals + ai_analysis paragraph + key_developments)
- `threat_assessments` — pandemic_probability + threat_level + reasoning + Polymarket comparison + triggers
- `facts` — verified facts with `key:*`-tagged subset surfaced in VirusProfile
- `scrape_log` — per-cycle observability for the pipeline
- `visitor_log` — unique visitors keyed by localStorage UUID; public read + insert; realtime publication for live count updates

Migrations live in `supabase/migrations/`. Use `npm run db:reset` to reapply locally (Colima/Docker required). Apply to remote with `supabase db push --linked`.

**Migrations sitting unapplied** (as of this CLAUDE.md): `20260509120000` (case_locations transit fields), `20260509130000` (case_relationships), `20260509140000` (scrape_log metrics), `20260509150000` (case_locations dedup). They ship with the pipeline rebuild.

## Pipeline (data ingestion)

Pathwatch's case/event data is written by a **separate Claude session**, not by the Next.js app. The runbook for that session is `docs/runbooks/pipeline.md` (agent-facing) plus `docs/runbooks/pipeline-operator.md` (human operator-facing).

There's a designed-but-not-yet-built API rebuild that replaces the SKILL-based pipeline with a Vercel Function:
- Spec: `docs/superpowers/specs/2026-05-09-pipeline-api-rebuild-design.md`
- Plan: `docs/superpowers/plans/2026-05-09-pipeline-api-rebuild.md` (28 TDD tasks)

Until the rebuild ships, manual cycles are run by opening a fresh Claude Code session in this repo and pasting the operator-runbook prompt. The session uses `supabase db query --linked` for all writes (no service-role key needed).

**Rule:** dossier text and structured fields can be added by ad-hoc research, but **status changes are owned by the pipeline only** — research never overwrites case status. Flag conflicts inline as "POSSIBLE CORRECTION" footnotes for pipeline review.

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
