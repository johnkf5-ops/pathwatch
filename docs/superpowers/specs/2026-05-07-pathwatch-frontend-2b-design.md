# Pathwatch Frontend 2b — Map + Charts

**Date:** 2026-05-07
**Sub-project:** 2b of 4 (this) → 2c event detail + deploy
**Status:** Draft, awaiting user review
**Depends on:** sub-project 2a (dashboard core), already merged to main

## Context

Sub-project 2a shipped the dashboard scaffold, situation overview, intelligence feed, country breakdown, and a reserved aside placeholder marked "Map and charts arrive in sub-project 2b." This cycle fills that placeholder with three components:

- Interactive map (MapLibre + free CARTO Dark Matter tiles, no token)
- Trend chart (Recharts line of cumulative cases over time)
- Source activity chart (Recharts bar of event counts by source over the last 7 days)

All three slot into the right column of the existing dashboard layout, fed by props from the same `DashboardClient` wrapper that already holds the events / snapshots / country_stats state.

## Goals

1. A live map that colors countries by case count and shows a popup with country details on click.
2. Pulsing markers for recent events (last 24h) at their lat/lng, sized by significance.
3. Trend chart rendering cumulative cases from snapshot history, with a clear empty-state when only one snapshot exists.
4. Source activity chart deriving counts from the events already in `DashboardClient` state — no extra fetches.
5. No new external account or API token required.
6. Map dynamically imported so it doesn't bloat the main bundle.

## Non-goals

- 3D globe view (v2).
- Marker clustering (current data volume doesn't warrant it).
- Filter coupling: clicking a country does NOT filter the feed (decided during brainstorming — simpler UX).
- Drill-down to sub-national regions.
- Continuous-gradient choropleth legend; we use three discrete buckets.
- Light theme map.

## Architecture

```
app/page.tsx (RSC)
  ├─ snapshot (latest)         ─┐
  ├─ snapshot history (30)     ─┤  All passed as props
  ├─ events                    ─┤
  └─ country_stats             ─┘
              ↓
  DashboardClient (existing, extended)
              ↓
   ┌──────────┴──────────────────────────────────────┐
   │                                                  │
SituationOverview · FilterBar · EventFeed · Country │ <aside>
                                                    │   MapPanel (dynamic)
                                                    │   TrendChart
                                                    │   SourceActivityChart
                                                    │ </aside>
```

**Realtime channels** (additions to existing 3):
- The existing `snapshots` channel pushes new snapshots into both `snapshot` (replace) and `snapshotHistory` (prepend) state.
- `country_stats` and `events` channels are reused; map and source-activity chart re-derive on prop change.

## Component contracts

### `MapPanel.tsx` (client, dynamic)
- **Props:** `{ countries: CountryStat[]; events: Event[] }`
- **Behavior:** Renders MapLibre `<Map>` with CARTO Dark Matter style. Loads `world.geo.json` once on mount; joins `countries` data by ISO alpha-2 code. Country fill color is one of three buckets based on `cases`: low (`cases == 1`) → `#FFB800`, mid (`2 ≤ cases ≤ 9`) → `#FF6B35`, high (`cases ≥ 10`) → `#FF3B3B`. Countries with 0 cases use the base map color. Thresholds chosen so the current seed (1–2 cases per country) shows visible differentiation; thresholds are constants in `lib/map-colors.ts` so they're easy to tune as the outbreak grows.
- Markers: events filtered to those with non-null `latitude` and `longitude` AND whose effective timestamp (`occurred_at ?? created_at`) is within the last 24 hours. Marker size scales with `significance` linearly: `size_px = 8 + significance * 2.4` (so sig=1 → 10.4px, sig=5 → 20px). Pulsing animation via CSS keyframe.
- Click country polygon → `<CountryTooltip>` popup. Click marker → `<EventTooltip>` popup.
- Default view: `center=[20, 10]`, `zoom=1.5`. Pan/zoom enabled.
- Loading/error: skeleton while geojson fetches; fallback text on map error.

### `CountryTooltip.tsx`
- **Props:** `{ country: CountryStat }`
- Renders inside MapLibre Popup: flag + country_name (h4), cases / deaths (mono), status Badge, dates.

### `EventTooltip.tsx`
- **Props:** `{ event: Event }`
- Renders inside MapLibre Popup: title (h4), summary (truncated to 120 chars), Source link.

### `TrendChart.tsx` (client)
- **Props:** `{ snapshots: Snapshot[] }` — array sorted ascending by `created_at`.
- Renders Recharts `LineChart` of `total_cases` over `created_at`. X-axis: time (date format `MMM d`). Y-axis: cases. One series. Surface-colored line, accent-colored dot at latest point.
- Empty state (`snapshots.length < 2`): bordered box, copy "Need at least 2 snapshots for a trend. The pipeline produces one every 1–2 hours." No chart rendered.

### `SourceActivityChart.tsx` (client)
- **Props:** `{ events: Event[] }`
- Derives counts internally: filter `events` to `created_at` within last 7 days; group by `source_type`; render Recharts `BarChart`. Bars use a single accent color. X-axis: source label (mapped via `LABEL` table from `SourceIcon`). Y-axis: count.
- Empty state: copy "No source activity in the last 7 days." No chart rendered.

### `DashboardClient.tsx` (modified)
- New prop: `initialSnapshotHistory: Snapshot[]`.
- New state: `snapshotHistory: Snapshot[]`. Realtime snapshot INSERT handler appends to history.
- Aside `<div>` placeholder is replaced with three stacked panels: `<MapPanel>`, `<TrendChart>`, `<SourceActivityChart>`. Each wrapped in `<Card>` with consistent padding.

### `app/page.tsx` (modified)
- Adds one new query in the `Promise.all`:
  ```ts
  supabase.from('snapshots').select('*')
    .eq('disease', 'hantavirus')
    .order('created_at', { ascending: true })
    .limit(30)
  ```
- Passes the resulting array as `initialSnapshotHistory` to `DashboardClient`.

## Data flow contracts

- `MapPanel` is dynamic-imported with `ssr: false`:
  ```ts
  const MapPanel = dynamic(() => import('@/components/map/MapPanel').then(m => m.MapPanel), {
    ssr: false,
    loading: () => <Skeleton className="h-[280px] w-full" />,
  });
  ```
- All three new panels are pure functions of their props plus internal state (no Supabase calls of their own).
- Source-activity derivation runs in `useMemo` keyed on `events` length to avoid recomputing on every render.

## Tile source and licensing

- Style URL: `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`
- License: CC BY 4.0 for the style; OpenStreetMap ODbL for underlying data.
- Attribution: MapLibre auto-renders attribution in the map's corner. We do NOT remove it.
- Free for non-commercial use; if Pathwatch turns commercial we revisit.

## Country geometry

`public/world.geo.json` — Natural Earth `ne_110m_admin_0_countries` simplified to ~50KB gzipped. Each feature has an `ISO_A2` property used to join with `country_stats.country_code`. License: public domain.

We commit the file to the repo (small enough; avoids runtime fetch from third party).

## Bundle impact

| Component | Approx gzipped | Loading |
|---|---|---|
| MapLibre GL JS | ~210 KB | dynamic, on map mount |
| world.geo.json | ~50 KB | fetched on map mount |
| Recharts | ~80 KB | static (charts render in initial paint) |

Main bundle stays at ~165 KB; map adds ~260 KB on user interaction with the dashboard (acceptable since it's the showpiece).

## Loading / empty / error states

| Surface | Loading | Empty | Error |
|---|---|---|---|
| Map | Skeleton sized to map height | Plain dark base map (no overlay) when no countries match | Fallback text + table reference |
| Trend chart | n/a (server-rendered) | "Need at least 2 snapshots…" copy | Recharts auto-handles empty arrays |
| Source activity chart | n/a | "No source activity in the last 7 days." | Same as trend |

## Testing

Extend `tests/dashboard.spec.ts` with three additional assertions:

```ts
// Map mounts and shows MapLibre's attribution control
await expect(page.locator('.maplibregl-ctrl-attrib')).toBeVisible();

// Source activity chart renders (data-testid on the wrapper)
await expect(page.getByTestId('source-activity-chart')).toBeVisible();

// Single-snapshot seed → trend empty state
await expect(page.getByText(/Need at least 2 snapshots/i)).toBeVisible();
```

`data-testid="source-activity-chart"` goes on the chart's outer wrapper. The empty-state copy serves as the trend chart's natural identifier.

Map screenshot tests are intentionally out of scope (flaky across renderers).

## Files added or modified

```
project_contagion/
├── app/
│   ├── DashboardClient.tsx          # MODIFY: + snapshotHistory state, + 3 panels in aside
│   └── page.tsx                     # MODIFY: + snapshot history fetch
├── components/
│   ├── map/
│   │   ├── MapPanel.tsx             # NEW
│   │   ├── CountryTooltip.tsx       # NEW
│   │   └── EventTooltip.tsx         # NEW
│   └── charts/
│       ├── TrendChart.tsx           # NEW
│       └── SourceActivityChart.tsx  # NEW
├── lib/
│   └── map-colors.ts                # NEW: bucket function for case counts
├── public/
│   └── world.geo.json               # NEW: Natural Earth 110m admin_0 simplified
├── tests/
│   └── dashboard.spec.ts            # MODIFY: + 3 assertions
└── package.json                     # MODIFY: + maplibre-gl, + recharts
```

Each new component file ≤ ~120 lines.

## Risks and open questions

- **CARTO tiles availability:** if their CDN returns 4xx, the map shows the no-tile fallback. Acceptable for v1; we don't self-host tiles.
- **MapLibre + Next.js dynamic import edge cases:** confirmed via plan to use `ssr: false` and gate any window access. The plan's verification step exercises this.
- **Recharts default colors:** override via `stroke` / `fill` props using our palette.
- **Snapshot history scarcity:** with seed = 1 snapshot, the trend chart is in empty state until the pipeline (sub-project 3) starts producing more. Smoke test asserts this empty state explicitly.
- **MapLibre version pinning:** pin to `^4` (latest stable line as of January 2026). Major versions sometimes change API; we'll bump deliberately later.

## Out of scope (next sub-project)

- 3D globe view — v2
- `/event/[id]` detail page — sub-project 2c
- Vercel deployment + OG image — sub-project 2c
- Mobile bottom-sheet drawer for popups — sub-project 2c
- Multi-disease selector — v2
