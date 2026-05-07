# Pathwatch Frontend 2a — App Skeleton + Dashboard Core

**Date:** 2026-05-07
**Sub-project:** 2a of 4 (this) → 2b map+charts → 2c event detail + deploy
**Status:** Draft, awaiting user review
**Depends on:** sub-project 1 (DB schema), already merged to main

## Context

Pathwatch's database is in place (`supabase/migrations/20260507000000_initial_schema.sql`) with seed data from the active MV Hondius hantavirus outbreak (8 cases / 3 deaths across 5 countries as of 2026-05-07). This sub-project builds the public dashboard's skeleton plus the panels that don't depend on map/chart vendors:

- App scaffold (Next.js 14, Tailwind, shadcn/ui, dark theme, Inter)
- TypeScript types matching the DB schema
- Supabase client (server + browser)
- Layout shell (header, footer)
- **Situation Overview** — reads latest snapshot
- **Intelligence Feed** — events list with significance/source/category filters and Realtime updates
- **Country Breakdown** — sortable per-country table
- `/about` page

Map (Mapbox), Trend chart, Source activity chart, and `/event/[id]` are deferred to 2b/2c.

## Goals

1. A deployable Next.js dashboard that renders the seeded outbreak data on first paint with no loading flash.
2. Live updates: new events from the pipeline appear in the feed without a refresh.
3. URL-driven filter state so views are shareable and refresh-safe.
4. Strong typing — DB schema → TS types → component props with no `any`.
5. Clean component boundaries: every file < ~150 lines, single responsibility.

## Non-goals

- Map of any kind (2b).
- Charts (2b).
- Event detail page (2c).
- Authentication / user accounts.
- Light theme toggle. Dark only.
- Server-side caching beyond Next.js's RSC defaults.
- Internationalization. English only.
- Mobile-first specialised UI (responsive Tailwind classes only; mobile polish is 2c).

## Architecture

```
        ┌──────────────────┐
        │  Supabase (PG)   │
        │  events,         │
        │  snapshots,      │
        │  country_stats   │
        └────────┬─────────┘
                 │ anon key
        ┌────────▼─────────┐
        │  app/page.tsx    │  Server Component
        │  3 parallel reads│  → SSR initial HTML
        └────────┬─────────┘
                 │ props
        ┌────────▼─────────────────────┐
        │  DashboardClient.tsx         │  Client Component
        │  3 Realtime channels:        │
        │    events INSERT             │
        │    snapshots INSERT          │
        │    country_stats INSERT/UPD  │
        └────────┬─────────────────────┘
                 │ props
        ┌────────▼─────────────────────────────────┐
        │  SituationOverview · EventFeed · Country │
        │  Breakdown                               │
        └──────────────────────────────────────────┘
```

Filter state lives in URL search params (`?sig=4&source=who&category=case_report`). Changing a filter calls `router.replace` which causes the RSC to refetch. The client preserves Realtime subscriptions across these refetches.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14, App Router | RSC for fast first paint, mature ecosystem |
| Language | TypeScript, `strict: true` | DB types flow end-to-end |
| Styling | Tailwind v3 | Spec already uses Tailwind classes |
| UI primitives | shadcn/ui | Spec calls for it; gives us Card/Badge/Table/Skeleton |
| Icons | lucide-react | Tree-shakable, matches shadcn |
| Date formatting | date-fns | Smaller than dayjs, tree-shakable |
| Database | @supabase/supabase-js v2 | Server + browser client |
| Font | Inter (next/font/google), JetBrains Mono | Per spec |
| Tests | Playwright (one smoke spec) | E2E catches the actual breakage cases |
| Lint | ESLint (next/core-web-vitals + ts) | Next.js default |

Deferred (2b): Recharts/Tremor, Mapbox/MapLibre.

## File layout

```
project_contagion/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── DashboardClient.tsx
│   ├── about/
│   │   └── page.tsx
│   ├── globals.css
│   ├── icon.svg
│   └── error.tsx
├── components/
│   ├── overview/
│   │   ├── SituationOverview.tsx
│   │   ├── StatCard.tsx
│   │   └── RiskBadge.tsx
│   ├── feed/
│   │   ├── EventFeed.tsx
│   │   ├── EventCard.tsx
│   │   ├── FilterBar.tsx
│   │   └── SourceIcon.tsx
│   ├── country/
│   │   └── CountryBreakdown.tsx
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   └── ui/
│       ├── SignificanceDot.tsx
│       ├── CategoryPill.tsx
│       ├── CountryFlag.tsx
│       ├── TimeAgo.tsx
│       └── LiveIndicator.tsx
├── lib/
│   ├── supabase-server.ts
│   ├── supabase-browser.ts
│   ├── types.ts
│   ├── format.ts
│   └── filters.ts
├── tests/
│   └── dashboard.spec.ts
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
├── package.json
├── playwright.config.ts
├── .env.local              # gitignored
└── .env.example
```

Every component file ≤ 150 lines. Files split by responsibility; no "utils.ts" dumping ground.

## TypeScript types (lib/types.ts)

Match the DB schema exactly. No optional fields where the column is NOT NULL.

```typescript
export interface Event {
  id: string;
  created_at: string;
  occurred_at: string | null;
  title: string;
  summary: string;
  raw_content: string | null;
  source_type: 'x' | 'cdc' | 'who' | 'google_news' | 'reddit' | 'bluesky' | 'ecdc' | 'africa_cdc' | 'wikipedia';
  source_url: string | null;
  source_url_hash: string | null;
  source_author: string | null;
  significance: 1 | 2 | 3 | 4 | 5;
  category: 'case_report' | 'policy' | 'research' | 'travel_advisory' | 'mutation' | 'death' | 'containment' | 'speculation';
  country_code: string | null;
  region: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  case_count: number | null;
  death_count: number | null;
  is_verified: boolean;
  tags: string[] | null;
  duplicate_of: string | null;
  disease: string;
}

export interface Snapshot {
  id: string;
  created_at: string;
  disease: string;
  total_cases: number | null;
  total_deaths: number | null;
  countries_affected: number | null;
  countries_list: string[] | null;
  fatality_rate: number | null;
  trend: 'accelerating' | 'stable' | 'declining' | null;
  trend_description: string | null;
  risk_level: 'low' | 'moderate' | 'high' | 'critical' | null;
  key_developments: string[] | null;
  ai_analysis: string | null;
}

export interface CountryStat {
  id: string;
  updated_at: string;
  disease: string;
  country_code: string;
  country_name: string;
  cases: number;
  deaths: number;
  first_case_date: string | null;
  latest_case_date: string | null;
  status: 'active' | 'contained' | 'monitoring' | 'clear' | null;
  travel_advisory: string | null;
  notes: string | null;
}

export interface FilterState {
  significance: 1 | 2 | 3 | 4 | 5 | null; // gte
  source: Event['source_type'] | null;
  category: Event['category'] | null;
  limit: number; // pagination
}
```

## Component contracts

### `SituationOverview` (Server Component)
- **Props:** `{ snapshot: Snapshot | null }`
- **Renders:** stat-card row (cases / deaths / countries / fatality / risk badge) + AI summary paragraph below
- **Empty:** if `snapshot` is null, render "Awaiting first snapshot" with `—` for stats

### `EventFeed` (Client Component)
- **Props:** `{ initialEvents: Event[]; initialFilters: FilterState }`
- **Behavior:** displays the events list. Subscribes to Realtime INSERTs filtered by `disease=eq.hantavirus`; new events that match current filters are prepended with a 300ms slide-in animation (Tailwind class). Filter changes update URL via `router.replace`; the RSC re-renders with fresh data.
- **"Load more":** button at bottom that bumps `limit` URL param by 50. No infinite scroll for 2a.

### `FilterBar` (Client Component)
- **Props:** `{ filters: FilterState }`
- **Behavior:** three pill groups (significance ≥, source, category). Click toggles the value in URL. "Clear filters" resets all params.

### `EventCard` (Server-or-client safe)
- **Props:** `{ event: Event }`
- **Renders:** SignificanceDot + SourceIcon + TimeAgo + bold title + 2-line summary + CategoryPill + (CountryFlag + name if present) + "Source ↗" link.

### `CountryBreakdown` (Client Component, for sort state)
- **Props:** `{ initialRows: CountryStat[] }`
- **Renders:** table with Flag, Country, Cases, Deaths, Status, First Case, Latest Update. Click column → sort asc/desc. Sort state is in component (not URL). Click row → in 2b this filters map; in 2a it's a no-op cursor.

### Atoms
- `SignificanceDot`: 8px circle, color from spec palette by significance level
- `CategoryPill`: rounded text label
- `CountryFlag`: emoji from country_code via `String.fromCodePoint(0x1F1E6 + ...)`
- `TimeAgo`: client component using `formatDistanceToNow` from date-fns
- `LiveIndicator`: small pulsing dot in header
- `RiskBadge`: color-coded box matching spec palette
- `SourceIcon`: switches `source_type` → lucide icon (Globe2 for who, Building for cdc/ecdc/africa_cdc, MessageSquare for x/bluesky, Newspaper for google_news, BookOpen for wikipedia, Hash for reddit)
- `StatCard`: big number + label + optional trend arrow

## Data flow contracts

### `lib/supabase-server.ts`
Exports `createServerClient()` that builds a server-side anon-key client per request (no cookies needed for public-read).

### `lib/supabase-browser.ts`
Exports `createBrowserClient()` that builds a singleton browser client used for Realtime subscriptions and for any client-only refetches.

### `app/page.tsx` (RSC)
```ts
const supabase = createServerClient();
const [{ data: snapshot }, { data: events }, { data: countries }] = await Promise.all([
  supabase.from('snapshots').select('*').eq('disease','hantavirus')
    .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  buildEventsQuery(supabase, parsedFilters),
  supabase.from('country_stats').select('*').eq('disease','hantavirus'),
]);
return <DashboardClient snapshot={snapshot} initialEvents={events ?? []} initialCountries={countries ?? []} initialFilters={parsedFilters} />;
```

### `DashboardClient.tsx`
Owns three subscriptions and three pieces of local state. Cleans up on unmount via `channel.unsubscribe()`.

## Filter state ↔ URL

```typescript
// lib/filters.ts
export function parseFilters(searchParams: URLSearchParams): FilterState
export function filtersToSearchParams(f: FilterState): URLSearchParams
export function buildEventsQuery(client: SupabaseClient, f: FilterState)
```

`buildEventsQuery` applies in order:
- `.eq('disease','hantavirus')`
- `.is('duplicate_of', null)`
- `.gte('significance', f.significance)` if set
- `.eq('source_type', f.source)` if set
- `.eq('category', f.category)` if set
- `.order('created_at', { ascending: false })`
- `.range(0, f.limit - 1)`

## Loading / empty / error states

| Surface | Loading | Empty | Error |
|---|---|---|---|
| Initial paint | RSC blocks; no skeleton needed | Stats show `—`, feed shows context message | `error.tsx` boundary with "Try again" button |
| Filter change | Brief `LiveIndicator` flicker | "No events match these filters" | Toast: "Failed to refetch — showing last results" |
| Realtime disconnect | n/a | n/a | Top banner: "Live connection lost. Reconnecting…" auto-reconnect every 30s |

## Color palette (CSS variables in globals.css)

Direct port of spec:
```css
:root {
  --bg: #0A0A0F;
  --surface: #12121A;
  --surface-hover: #1A1A25;
  --border: #2A2A35;
  --text: #E8E8ED;
  --text-secondary: #8888A0;
  --text-muted: #555570;
  --sig-5: #FF3B3B;
  --sig-4: #FF6B35;
  --sig-3: #FFB800;
  --sig-2: #4ADE80;
  --sig-1: #6B7280;
  --accent: #3B82F6;
}
```

Tailwind config extends with these custom colors so utility classes work (`bg-surface`, `text-sig-5`, etc.).

## Layout structure

`app/page.tsx` renders within `app/layout.tsx`:

```
<Header />
  <main>
    <SituationOverview /> (full width)
    <div class="grid lg:grid-cols-[1fr_minmax(0,440px)] gap-4">
      <div>
        <FilterBar />
        <EventFeed />
      </div>
      <aside>
        {/* Map placeholder slot — empty in 2a, filled in 2b */}
        <div class="border-dashed text-text-muted">Map (sub-project 2b)</div>
      </aside>
    </div>
    <CountryBreakdown />
  </main>
<Footer />
```

The placeholder div is a deliberate seam so 2b drops the map in without restructuring.

## Testing

### Smoke test: `tests/dashboard.spec.ts`

Pre-conditions: local Supabase up, seed loaded, dev server running on :3000.

```typescript
test('dashboard renders MV Hondius outbreak data', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Pathwatch')).toBeVisible();           // header
  await expect(page.getByTestId('stat-cases')).toContainText('8');
  await expect(page.getByTestId('stat-deaths')).toContainText('3');
  await expect(page.getByTestId('stat-countries')).toContainText('5');
  await expect(page.getByTestId('stat-fatality')).toContainText('37');// 0.375 rendered as 37% or 37.5%
  await expect(page.getByTestId('risk-badge')).toContainText(/moderate/i);
  await expect(page.getByText(/MV Hondius/i)).toBeVisible();          // feed
  await expect(page.getByText('Argentina')).toBeVisible();            // country table
  await expect(page.getByText('Cape Verde')).toBeVisible();
});
```

`data-testid` attributes are added to exactly five elements: `stat-cases`, `stat-deaths`, `stat-countries`, `stat-fatality`, and `risk-badge`. All other content is asserted via accessible name / visible text.

### Lint + typecheck

```bash
npm run lint        # next lint
npm run typecheck   # tsc --noEmit
```

Both run in CI later (sub-project 2c will set up GitHub Actions if/when remote is added).

## Environment variables

`.env.local` (gitignored):
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<published by `supabase status`>
```

`.env.example` ships with placeholder values.

## Out of scope (deferred)

- **Map** (2b): Mapbox or MapLibre choropleth + markers, click → filter feed
- **Charts** (2b): Trend chart (cases over time), source activity bar chart
- **Event detail** (2c): `/event/[id]` with related events + raw_content view
- **Vercel deployment** (2c)
- **OG image generation** (2c)
- **Mobile drawer / bottom sheet polish** (2c)
- **Light theme toggle** — never (dark only per spec)
- **Multi-disease selector** in header — not until v2

## Risks and open questions

- **Realtime auth on local Supabase:** the local stack supports anon Realtime by default; smoke test will verify a programmatic INSERT bubbles into a subscription before we ship.
- **Anon key in browser:** intentional — that's its purpose. No service role exposure anywhere in this codebase.
- **Server-rendered times getting stale:** `TimeAgo` is a client component so it updates after hydration; no per-second re-renders to keep render cost low.
- **Filter URL collisions with future params:** namespace if necessary; for 2a the four params are unambiguous.
