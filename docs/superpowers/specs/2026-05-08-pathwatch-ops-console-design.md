# Pathwatch — Ops Console UI (Sub-project 2.6)

**Date:** 2026-05-08
**Sub-project:** 2.6 — final frontend cycle before deploy
**Status:** Draft, awaiting user review
**Depends on:** sub-projects 1, 2a, 2b, 2c, 2.5 — all merged to main; remote Supabase has the full schema applied.

## Context

The dashboard at `/` currently uses the 2a/2b/2c layout — generic dark-theme cards, situation overview, scrolling event feed, aside with map/charts, country table at the bottom. It does not yet consume the `cases` / `case_locations` schema from sub-project 2.5.

This sub-project rebuilds `/` in the **Ops Console** style from the design handoff at `/tmp/pathwatch-design/design_handoff_pathwatch_ops_console/`: a split-screen operator workspace — left column is a vertically-scrolling situation report, right column is a tabbed analytical workspace (Map + By country only for v1; mutations/cams/wastewater hidden until data exists). The aesthetic is "calm control room / intel terminal" — dense monospace UI, dark cool palette, signal colors reserved for status.

It also wires up the cases drilldown the user wants: clicking a case marker on the map opens a slide-in dossier drawer and draws their travel path on the map; URL state (`?case=MVH-001`) makes the drawer-open state shareable; `/case/[case_code]` is a standalone permalink page using the same dossier component.

## Goals

1. Replace `/` with the Ops Console split layout, top bar, intel-terminal palette, mono-heavy typography. No remnants of the 2a-style dashboard.
2. Sit-rep stack on the left: Situation brief + KPI grid + Posture matrix + Watchlist (top 5 events from last 24h).
3. Tabbed workspace on the right: Map + By country. Other tabs hidden until backing data exists.
4. Map shows case markers (status-colored) as the primary surface. Click a marker → slide-in drawer with full dossier + travel path drawn on the map. Click country polygon → drawer with country stats + case list. URL params (`?case=` / `?country=`) reflect drawer state.
5. `/case/[case_code]` standalone page (mirror of `/event/[id]`) for shareable case permalinks.
6. Realtime: `cases` and `case_locations` subscriptions added. Status transitions and new locations show without refresh.
7. Existing `/event/[id]` and `/about` routes stay; OG images stay; smoke tests updated.

## Non-goals

- 3D globe (v2)
- Tone toggle UI (cool/warm/neutral) — CSS supports it via `data-tone`, no UI control shipped
- Mutations / Field cams / Wastewater tabs — hidden because no data
- Trend chart / Source activity chart — dropped; not in the Ops Console design
- Full-feed event scrolling — replaced by Watchlist (top 5 from last 24h); deeper history accessed via `/event/[id]` permalinks
- Mobile-first redesign — desktop primary; sit-rep collapses below `lg`
- Live UTC ticker (1-second updates) — static current-time render is fine for v1

## Architecture

```
app/page.tsx (RSC)
  ├── snapshot                    ─┐
  ├── snapshotHistory (30)        ─┤
  ├── events (top 50, last 24h)   ─┤  parallel fetch
  ├── country_stats               ─┤
  ├── cases (all for disease)     ─┤
  └── case_locations (all)        ─┘
              ↓
  DashboardClient (rewritten as Ops Console root)
              ↓
  ┌───────────┴────────────────────────────────────────────────┐
  │  TopBar                                                    │
  ├──────────────────┬─────────────────────────────────────────┤
  │  SitRep (left)   │  Workspace (right)                      │
  │  ─ SituationBrief│  ─ TabStrip                             │
  │  ─ KpiGrid       │  ─ MapPane (active by default)          │
  │  ─ PostureMatrix │      ↳ MapPanel + TravelPathLayer       │
  │  ─ Watchlist     │      ↳ DossierDrawer (slides in right)  │
  │                  │  ─ ByCountryPane                        │
  └──────────────────┴─────────────────────────────────────────┘
```

URL state:
- `/` — dashboard, no drawer
- `/?case=MVH-001` — Map tab, case drawer open, travel path drawn
- `/?country=AR` — Map tab, country drawer open
- `/case/MVH-001` — standalone page (same `CaseDossier` component, no drawer)

Realtime channels (delta vs current):
- `cases` (INSERT, UPDATE) → updates dossier in drawer if open + map marker color
- `case_locations` (INSERT) → adds to travel path if owning case is open

## Tech stack (delta vs 2c)

No new deps. Continues using Next.js 14 App Router, TS strict, Tailwind v3, MapLibre, Recharts (kept installed even though charts dropped — small bundle impact, useful for future).

## Color palette

Tailwind config rewritten. Old palette dropped wholesale.

```ts
colors: {
  bg:          '#07080c',
  'bg-2':      '#0b0d13',
  surface:     '#10131c',
  'surface-2': '#161a25',
  'surface-3': '#1d2231',
  line:        '#232a3a',
  'line-soft': '#1a2030',
  'line-strong':'#34405a',
  text: {
    DEFAULT: '#d6dae6',
    2:       '#8a93a8',
    3:       '#5b6378',
    4:       '#3d4458',
  },
  green:  '#2ee37a',
  amber:  '#f5b041',
  orange: '#ff7f3f',
  red:    '#ff4d5e',
  cyan:   '#4cd6ff',
  violet: '#a78bff',
}
```

Tailwind class naming examples: `bg-bg`, `bg-surface`, `text-text`, `text-text-2`, `border-line`, `bg-green`, `text-red`, etc.

## Typography

```
Mono ('JetBrains Mono'): all headings, numbers, labels, KPI values, table cells, top-bar text
Sans ('Inter'): paragraph prose only — situation brief subhead, dossier narrative, watchlist summaries
```

Common styles:
- Section header: mono 10.5px / 0.14em / uppercase / `text-text-2`
- KPI label: mono 9.5px / 0.1em / uppercase / `text-text-3`
- KPI value: mono 22px / 700 / `text-text` / tabular-nums
- Headline: mono 22px / 700 / `-0.01em` / `text-text` / leading-tight
- Subhead body: sans 13px / 1.5 / `text-text-2` / max-w-[60ch]
- Tab label: mono 10.5px / 0.1em / uppercase
- Table row: mono 11.5px

## Layout

Top bar (height 32px): brand mark + "PATHWATCH" + "OPS CONSOLE" subtitle + LIVE pulse + flex spacer + scope (`SCOPE GLOBAL`) + `UTC <static-time>` + risk pill (color from snapshot.risk_level).

Body: `grid-template-columns: 1fr 1fr`. 1px `--line` divider on the left column's right edge. Each column owns its own `overflow-y: auto`.

Left column (sit-rep stack): vertical, sections separated by 1px `line` rules. Each section has padding `10px 14px 14px`.

Right column (workspace): tab strip across the top, then a single `position: absolute; inset: 0; padding-top: <tab-strip>` pane area. Tab content swaps via local React state (no URL-routed tabs).

Border radius: 2px throughout (terminal aesthetic — do NOT round more).

Below `lg` breakpoint: split collapses, sit-rep stacks above workspace.

## Component contracts

### `TopBar.tsx` (server, static-time)
- **Props:** `{ snapshot: Snapshot | null }`
- **Behavior:** brand block, LIVE pulse dot, "SCOPE GLOBAL" + UTC time (rendered server-side; not a live ticker), risk pill color from `snapshot.risk_level`.

### `SituationBrief.tsx`
- **Props:** `{ snapshot: Snapshot | null }`
- Mono headline (22/700) — first 1-2 lines of `snapshot.ai_analysis` or `snapshot.trend_description`. Subhead (sans 13/1.5) — full `ai_analysis` paragraph. Right-aligned timestamp pill (`● 3 MIN AGO` style) showing freshness from `snapshot.created_at`.

### `KpiGrid.tsx` + `KpiTile.tsx`
- **Props (Grid):** `{ snapshot, snapshotHistory }`
- 4 tiles: Cases 24h (delta vs prev snapshot), Deaths 24h (delta), CFR % (delta vs prev), Countries (delta).
- **Tile shape:** mono uppercase label (10/0.1em), mono 22/700 value, mono 10.5 delta. Delta tinted: up-is-bad (cases/deaths/CFR) → red; up-is-good (countries) → text-text-2 (neutral).

### `PostureMatrix.tsx`
- **Props:** `{ countries: CountryStat[] }`
- Compact heatmap. Header row: COUNTRY · CASES · DEATHS · STATUS. Body rows = each country in `country_stats`. Cell intensity scales bucketed: 0 transparent, 1 green-dim, 2-3 amber-dim, 4-9 orange-dim, 10+ red-dim. Status column is a colored text tag (active=red text, contained=amber, monitoring=green, clear=text-muted).

### `Watchlist.tsx` + `WatchlistItem.tsx`
- **Props (List):** `{ events: Event[] }`
- Filters client-side: events whose effective timestamp is within last 24h, sorted by `significance DESC, created_at DESC`, first 5.
- **Item shape:** mono time-delta (`3 MIN`), source code (`WHO`), headline (truncated 2 lines), tag (ALERT red for sig 5, WATCH orange for sig 4, no tag below). Click → navigates to `/event/[id]`.

### `TabStrip.tsx`
- **Props:** `{ active, onChange, tabs: { id, label, count? }[] }`
- Renders Map / By country tabs. Active tab: `bg-surface` background, `border-b-2 border-green`, `text-text` foreground. Inactive: `text-text-3`. Count chips next to label.
- Hidden tabs (Mutations, Field cams, Wastewater) NOT rendered. Easy to re-enable later.

### `MapPane.tsx`
- **Props:** `{ countries, cases, caseLocations, events }`
- Wraps `MapPanel` (existing) + adds:
  - Case marker layer (replacing the recent-event marker layer): one marker per case at the case's current location (latest `case_locations` row by `arrived_at`, fallback to lat/lng of first stop). Color by `status`. Click → push `?case=<code>`.
  - `<TravelPathLayer />` rendered when a case is selected.
  - `<DossierDrawer />` rendered when `?case=` or `?country=` is set.

### `TravelPathLayer.tsx`
- **Props:** `{ map: maplibregl.Map; case_id: string; locations: CaseLocation[] }`
- Adds a MapLibre line layer connecting the case's locations in `arrived_at` order. Line color matches case status. Markers at each stop with stop number labels. Cleans up layer + sources on unmount.

### `DossierDrawer.tsx`
- **Props:** `{ open: boolean; case_?: Case; country_?: CountryStat; cases?: Case[]; locations?: CaseLocation[]; onClose: () => void }`
- Slides in from the right edge of the Map tab area only. Width `min(420px, 90vw)`. Background `surface-2`, border-left `line-strong`, no rounded corners.
- If `case_` is set: renders `<CaseDossier>` + "Open ↗" link to `/case/<code>`.
- If `country_` is set: renders country stats header + scrollable case list (case_code, status pill, current location). Each item links to `?case=<code>`.
- Close button (X) clears the relevant URL param.

### `CaseDossier.tsx` (used by drawer + standalone page)
- **Props:** `{ case_: Case; locations: CaseLocation[]; sourceEvent?: Event | null }`
- Header: case_code (mono 22/700), status pill, role/age/sex line.
- Body sections: Dossier narrative (sans), Key dates (mono labeled list — exposure / onset / confirmed / outcome), Travel timeline (`<TravelTimeline>`), Linked event (if `source_event_id`).

### `TravelTimeline.tsx`
- **Props:** `{ locations: CaseLocation[] }`
- Vertical list of stops. Each: mono date label (`MAR 29 → APR 02`), country flag, location name, context, exposure-site marker if applicable.

### `CaseStatusPill.tsx`
- **Props:** `{ status: Case['status'] }`
- Mono uppercase 9.5px, color matches status (deceased=red, critical=orange, confirmed=amber, suspected=cyan, recovered=green).

### `ByCountryPane.tsx`
- **Props:** `{ countries: CountryStat[] }`
- Built fresh with the new tokens (the old `CountryBreakdown.tsx` is deleted). Same sortable columns as before — Flag, Country, Cases, Deaths, Status, First Case, Latest Update — but mono typography throughout, hard 2px-radius borders, status as a colored text tag matching the Posture matrix. Click row → push `?country=<code>` to URL (drawer opens when user switches back to the Map tab).

## Data flow contracts

### `app/page.tsx` (modified)
```ts
const [snapshot, history, events, countries, cases, caseLocations] = await Promise.all([
  // existing 4 queries unchanged
  supabase.from('cases').select('*').eq('disease', 'hantavirus'),
  supabase.from('case_locations').select('*'),
]);
```

Both new queries are unfiltered by case_id since the dashboard renders the global view; per-case fetches happen client-side via the cached `caseLocations` array (locations are tiny — ~30 rows).

### `DashboardClient` Realtime additions

```ts
.channel('cases-realtime')
.on('postgres_changes',
  { event: '*', schema: 'public', table: 'cases', filter: 'disease=eq.hantavirus' },
  (payload) => mergeCaseUpdate(payload))
.subscribe();

.channel('case-locations-realtime')
.on('postgres_changes',
  { event: 'INSERT', schema: 'public', table: 'case_locations' },
  (payload) => appendLocation(payload.new))
.subscribe();
```

## Loading / empty / error states

| Surface | Loading | Empty | Error |
|---|---|---|---|
| Top bar | n/a (server-rendered) | Risk pill shows `—` | none |
| Situation brief | n/a | "Awaiting first snapshot." | error.tsx route boundary |
| KPI grid | n/a | Tiles show `—` | same |
| Posture matrix | n/a | "No country data yet." | same |
| Watchlist | n/a | "No alerts in the last 24 hours." | same |
| Map | Skeleton (220px–280px height) | Plain dark tiles | "Map unavailable. Switch to By country." |
| By country | n/a | "No country data yet." | same |
| Drawer | spinner if case fetched lazily (not in v1) | n/a | "Failed to load case." with retry |

## Files dropped (committed deletions)

```
components/overview/SituationOverview.tsx
components/overview/RiskBadge.tsx          # may inline into TopBar; verify before deleting
components/overview/StatCard.tsx           # KpiTile is the replacement
components/feed/EventCard.tsx
components/feed/EventFeed.tsx
components/feed/FilterBar.tsx
components/feed/SourceIcon.tsx             # KEEP — used by Watchlist + CaseDossier
components/charts/TrendChart.tsx
components/charts/SourceActivityChart.tsx
components/country/CountryBreakdown.tsx    # ByCountryPane is built fresh with new tokens
components/layout/Header.tsx
components/layout/Footer.tsx
```

`SourceIcon.tsx` stays. `RiskBadge.tsx` is reviewed during implementation — if `TopBar` re-implements the pill from scratch, RiskBadge gets dropped; otherwise reused.

`tests/dashboard.spec.ts` rewrite: keep `OG image generates` and `event detail page renders`; replace the dashboard rendering / map+charts tests with the three new specs (sit-rep + tabs visible, case drilldown, case permalink).

## Files added

See "What's new" section in the architecture overview above.

## Risks and open questions

- **Case markers replace event markers.** Events from last 24h with lat/lng are no longer plotted. Watchlist surfaces them instead. If the user misses event markers, we re-introduce as a toggleable layer in a follow-up — not v1.
- **Drawer + URL state coordination.** The drawer is mounted always but visible only when URL params are set. `useSearchParams` drives the visibility; close button calls `router.replace(pathname)` to clear. Edge case: user navigates back/forward — drawer opens/closes correctly because URL is the source of truth.
- **MapLibre layer cleanup.** Travel path layer must clean up source + layer on unmount/case-change to avoid duplicate-source errors. The component owns its lifecycle.
- **Posture matrix on tiny seed.** Five rows of countries with 1-2 cases each will look sparse but not broken. The bucket thresholds tolerate small numbers.
- **Watchlist with tag noise.** Sig 1-3 events get no tag. Some clusters may show no tag rows for 24h periods. Acceptable.
- **`SectionHeader.tsx` may turn out to be just a Tailwind class combo.** If implementation reveals it adds no value over `<h2 className="...">`, drop it.

## Out of scope (next sub-projects)

- Sub-project 3: facts schema + /facts page + pipeline runbook
- Mutations / Field cams / Wastewater data + their tabs
- Trend chart re-introduction
- Mobile bottom-sheet drawer
- Tone toggle UI
- Real-time UTC ticker
- Sub-project 4: snapshot/analysis automation
