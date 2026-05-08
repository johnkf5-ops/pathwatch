# Pathwatch Frontend 2b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the dashboard's reserved aside with three live data widgets — MapLibre choropleth + event markers, Recharts trend line, Recharts source activity bar — all fed via props from the existing `DashboardClient`.

**Architecture:** `app/page.tsx` adds one new parallel fetch (snapshot history). `DashboardClient` gains a `snapshotHistory` prop and renders three new panels in the existing aside placeholder. The map is dynamic-imported (`ssr: false`) so MapLibre's ~210 KB stays out of the main bundle. Country choropleth joins `country_stats.country_code` (ISO_A2) to `world.geo.json` features (ISO_A3) via `iso-3166-1`.

**Tech Stack:** maplibre-gl ^4, recharts ^2, iso-3166-1 (already-installed: Next.js 14, TS strict, Tailwind, supabase-js).

**Spec:** `docs/superpowers/specs/2026-05-07-pathwatch-frontend-2b-design.md`

**Prerequisites (verify once before starting):**
- On `main` after sub-project 2a merge: `git log --oneline -1` shows the 2a merge commit.
- Local Supabase running with seeded data: `./scripts/reset-db.sh` succeeds.
- `npm run test:smoke` passes (sub-project 2a baseline) before any 2b work begins.
- Working directory: `/Users/claude/Projects/project_contagion`.

---

### Task 1: Install dependencies and bring up MapLibre CSS

**Files:**
- Modify: `package.json` (deps)

- [ ] **Step 1: Create the feature branch**

```bash
cd /Users/claude/Projects/project_contagion
git checkout -b feat/frontend-2b
```

- [ ] **Step 2: Install runtime deps**

```bash
npm install maplibre-gl@^4 recharts@^2 iso-3166-1
```

Expected: completes with no peer-dep errors. `maplibre-gl` ships its own CSS at `node_modules/maplibre-gl/dist/maplibre-gl.css`.

- [ ] **Step 3: Verify versions installed**

```bash
node -p "require('maplibre-gl/package.json').version"
node -p "require('recharts/package.json').version"
node -p "require('iso-3166-1/package.json').version"
```

Expected: prints `4.x.x`, `2.x.x`, and a version (likely `^2`).

- [ ] **Step 4: Verify typecheck and lint still clean**

```bash
npm run typecheck
npm run lint
```

Expected: both exit 0 (no code change yet, just deps).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
Install maplibre-gl, recharts, iso-3166-1 for sub-project 2b

maplibre-gl drives the interactive map (CARTO Dark Matter tiles, no
token). recharts renders the trend and source activity charts.
iso-3166-1 resolves DB-stored ISO_A2 codes to the ISO_A3 codes used
by the Natural Earth GeoJSON we're about to add.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add `lib/map-colors.ts`

**Files:**
- Create: `lib/map-colors.ts`

- [ ] **Step 1: Write the helper**

Create `/Users/claude/Projects/project_contagion/lib/map-colors.ts`:
```ts
export type CaseBucket = 'low' | 'mid' | 'high' | 'none';

export const BUCKET_COLOR: Record<CaseBucket, string> = {
  low: '#FFB800',
  mid: '#FF6B35',
  high: '#FF3B3B',
  none: 'transparent',
};

// Thresholds tuned for the current MV Hondius outbreak (1–2 cases per country
// in seed). Bump these as the outbreak grows.
export function caseBucket(cases: number | null | undefined): CaseBucket {
  if (cases == null || cases <= 0) return 'none';
  if (cases === 1) return 'low';
  if (cases <= 9) return 'mid';
  return 'high';
}

export function markerSizePx(significance: 1 | 2 | 3 | 4 | 5): number {
  return 8 + significance * 2.4;
}
```

- [ ] **Step 2: Verify**

```bash
npm run typecheck && npm run lint
```

Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/map-colors.ts
git commit -m "$(cat <<'EOF'
Add map-colors helper

Three case-count buckets (none/low/mid/high) with tuned thresholds
(0 / 1 / 2-9 / 10+) that produce visible differentiation on the
current seed where most affected countries have 1-2 cases.
markerSizePx returns the marker diameter for a given significance
level, used by both MapPanel and the keyframe animation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Download `world.geo.json`

**Files:**
- Create: `public/world.geo.json`

- [ ] **Step 1: Download Natural Earth countries from datahub**

```bash
mkdir -p public
curl -fL --retry 3 \
  -o public/world.geo.json \
  https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson
```

Expected: file lands at `public/world.geo.json`.

- [ ] **Step 2: Sanity-check the shape**

```bash
node -e "const g=require('./public/world.geo.json'); console.log('features:', g.features.length); console.log('keys[0]:', Object.keys(g.features[0].properties));"
```

Expected: prints something like `features: 255` and `keys[0]: [ 'ADMIN', 'ISO_A3' ]`. The file is ~250 KB.

- [ ] **Step 3: Verify lint/typecheck (no code change but eslint shouldn't lint json)**

```bash
npm run typecheck && npm run lint
```

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add public/world.geo.json
git commit -m "$(cat <<'EOF'
Add Natural Earth world.geo.json for choropleth

Source: datahub.io/core/geo-countries (Natural Earth 1:50m, public
domain). Each feature has ADMIN and ISO_A3 properties; we use
iso-3166-1 to resolve our DB's ISO_A2 codes onto these features at
runtime.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Build map tooltips (`CountryTooltip` + `EventTooltip`)

**Files:**
- Create: `components/map/CountryTooltip.tsx`
- Create: `components/map/EventTooltip.tsx`

These are tiny presentation-only components. MapPanel will render them into MapLibre Popups via `react-dom/client`'s `createRoot` (handled in Task 5).

- [ ] **Step 1: Write `CountryTooltip.tsx`**

Create `/Users/claude/Projects/project_contagion/components/map/CountryTooltip.tsx`:
```tsx
import type { CountryStat } from '@/lib/types';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { Badge } from '@/components/ui/Badge';
import { formatNumber } from '@/lib/format';

export function CountryTooltip({ country }: { country: CountryStat }) {
  return (
    <div className="min-w-[180px] text-text">
      <div className="mb-2 flex items-center gap-2">
        <CountryFlag code={country.country_code} className="text-xl" />
        <h4 className="text-sm font-semibold">{country.country_name}</h4>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-text-muted">Cases</dt>
        <dd className="font-mono tabular-nums">{formatNumber(country.cases)}</dd>
        <dt className="text-text-muted">Deaths</dt>
        <dd className="font-mono tabular-nums">{formatNumber(country.deaths)}</dd>
        <dt className="text-text-muted">First case</dt>
        <dd>{country.first_case_date ?? '—'}</dd>
        <dt className="text-text-muted">Latest</dt>
        <dd>{country.latest_case_date ?? '—'}</dd>
      </dl>
      {country.status && (
        <div className="mt-2">
          <Badge variant="outline">{country.status}</Badge>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `EventTooltip.tsx`**

Create `/Users/claude/Projects/project_contagion/components/map/EventTooltip.tsx`:
```tsx
import type { Event } from '@/lib/types';
import { SourceIcon } from '@/components/ui/SourceIcon';
import { SignificanceDot } from '@/components/ui/SignificanceDot';

function truncate(s: string, n: number) {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}

export function EventTooltip({ event }: { event: Event }) {
  return (
    <div className="min-w-[220px] max-w-[260px] text-text">
      <div className="mb-1.5 flex items-center gap-2">
        <SignificanceDot level={event.significance} />
        <SourceIcon source={event.source_type} />
      </div>
      <h4 className="mb-1 text-sm font-semibold leading-snug">{event.title}</h4>
      <p className="text-xs text-text-secondary">{truncate(event.summary, 120)}</p>
      {event.source_url && (
        <a
          href={event.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-accent hover:underline"
        >
          Source ↗
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck && npm run lint
```

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add components/map/
git commit -m "$(cat <<'EOF'
Add CountryTooltip and EventTooltip for the map popups

Both render dl/h4-style cards consistent with the dashboard's
existing visual vocabulary (CountryFlag, SignificanceDot,
SourceIcon, Badge). MapPanel wires these to MapLibre Popups
via createRoot in the next task.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Build `MapPanel`

**Files:**
- Create: `components/map/MapPanel.tsx`

- [ ] **Step 1: Write `MapPanel.tsx`**

Create `/Users/claude/Projects/project_contagion/components/map/MapPanel.tsx`:
```tsx
'use client';
import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { type Map as MlMap, type GeoJSONSource } from 'maplibre-gl';
import { whereAlpha2 } from 'iso-3166-1';
import { createRoot, type Root } from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { CountryStat, Event } from '@/lib/types';
import { caseBucket, BUCKET_COLOR, markerSizePx } from '@/lib/map-colors';
import { CountryTooltip } from './CountryTooltip';
import { EventTooltip } from './EventTooltip';

const TILE_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface Props {
  countries: CountryStat[];
  events: Event[];
}

export function MapPanel({ countries, events }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRootsRef = useRef<Root[]>([]);

  // Map ISO_A3 → bucket so the choropleth only needs a single dictionary lookup
  const iso3ToBucket = useMemo(() => {
    const m = new Map<string, ReturnType<typeof caseBucket>>();
    for (const c of countries) {
      const entry = whereAlpha2(c.country_code);
      if (entry?.alpha3) m.set(entry.alpha3, caseBucket(c.cases));
    }
    return m;
  }, [countries]);

  // Map ISO_A3 → CountryStat so the click handler can pop the right tooltip
  const iso3ToCountry = useMemo(() => {
    const m = new Map<string, CountryStat>();
    for (const c of countries) {
      const entry = whereAlpha2(c.country_code);
      if (entry?.alpha3) m.set(entry.alpha3, c);
    }
    return m;
  }, [countries]);

  const recentEvents = useMemo(() => {
    const cutoff = Date.now() - ONE_DAY_MS;
    return events.filter(
      (e) =>
        e.latitude != null &&
        e.longitude != null &&
        new Date(e.occurred_at ?? e.created_at).getTime() >= cutoff,
    );
  }, [events]);

  // Mount once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: TILE_STYLE,
      center: [20, 10],
      zoom: 1.5,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.on('load', async () => {
      const geo = await fetch('/world.geo.json').then((r) => r.json());
      // Augment each feature with the bucket for that ISO_A3
      for (const f of geo.features) {
        const iso3 = f.properties?.ISO_A3;
        f.properties.bucket = iso3 ? (iso3ToBucket.get(iso3) ?? 'none') : 'none';
      }

      map.addSource('countries', { type: 'geojson', data: geo });
      map.addLayer({
        id: 'countries-fill',
        type: 'fill',
        source: 'countries',
        paint: {
          'fill-color': [
            'match',
            ['get', 'bucket'],
            'low', BUCKET_COLOR.low,
            'mid', BUCKET_COLOR.mid,
            'high', BUCKET_COLOR.high,
            BUCKET_COLOR.none,
          ],
          'fill-opacity': 0.55,
        },
      });

      map.on('click', 'countries-fill', (e) => {
        const f = e.features?.[0];
        const iso3 = f?.properties?.ISO_A3 as string | undefined;
        const country = iso3 ? iso3ToCountry.get(iso3) : undefined;
        if (!country) return;
        const el = document.createElement('div');
        const root = createRoot(el);
        popupRootsRef.current.push(root);
        root.render(<CountryTooltip country={country} />);
        new maplibregl.Popup({ closeButton: true, className: 'pathwatch-popup' })
          .setLngLat(e.lngLat)
          .setDOMContent(el)
          .addTo(map);
      });

      map.on('mouseenter', 'countries-fill', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'countries-fill', () => (map.getCanvas().style.cursor = ''));
    });

    return () => {
      popupRootsRef.current.forEach((r) => r.unmount());
      popupRootsRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // Mount-once intentionally: subsequent prop changes are handled by the next two effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update choropleth when `countries` changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getSource('countries')) return;
    const src = map.getSource('countries') as GeoJSONSource;
    // Re-fetch the base geojson is wasteful; mutate the existing data via setData with bucket update.
    fetch('/world.geo.json')
      .then((r) => r.json())
      .then((geo) => {
        for (const f of geo.features) {
          const iso3 = f.properties?.ISO_A3;
          f.properties.bucket = iso3 ? (iso3ToBucket.get(iso3) ?? 'none') : 'none';
        }
        src.setData(geo);
      });
  }, [iso3ToBucket]);

  // Render markers (declarative: blow them away and re-create)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers: maplibregl.Marker[] = [];

    function attach() {
      for (const ev of recentEvents) {
        const el = document.createElement('div');
        el.className = 'pathwatch-marker';
        const size = markerSizePx(ev.significance);
        el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${BUCKET_COLOR.high};box-shadow:0 0 0 3px ${BUCKET_COLOR.high}33;animation:pathwatchPulse 2s infinite;cursor:pointer;`;
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([ev.longitude!, ev.latitude!])
          .addTo(map);
        el.addEventListener('click', () => {
          const popupEl = document.createElement('div');
          const root = createRoot(popupEl);
          popupRootsRef.current.push(root);
          root.render(<EventTooltip event={ev} />);
          new maplibregl.Popup({ closeButton: true, className: 'pathwatch-popup' })
            .setLngLat([ev.longitude!, ev.latitude!])
            .setDOMContent(popupEl)
            .addTo(map);
        });
        markers.push(marker);
      }
    }

    if (map.loaded()) attach();
    else map.once('load', attach);

    return () => markers.forEach((m) => m.remove());
  }, [recentEvents]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div ref={containerRef} className="h-[280px] w-full" />
    </div>
  );
}
```

- [ ] **Step 2: Add the pulse keyframe to `globals.css`**

Append to `/Users/claude/Projects/project_contagion/app/globals.css`:
```css

/* Map markers pulse */
@keyframes pathwatchPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.6; transform: scale(1.18); }
}

/* MapLibre popup body — tighten to match the dashboard surface */
.pathwatch-popup .maplibregl-popup-content {
  background: #12121A;
  color: #E8E8ED;
  border: 1px solid #2A2A35;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
.pathwatch-popup .maplibregl-popup-tip {
  border-top-color: #12121A;
}
.pathwatch-popup .maplibregl-popup-close-button {
  color: #8888A0;
  font-size: 18px;
}
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck && npm run lint
```

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add components/map/MapPanel.tsx app/globals.css
git commit -m "$(cat <<'EOF'
Add MapPanel: MapLibre choropleth + recent-event markers

CARTO Dark Matter tiles (no token). Country fill is computed from
caseBucket(country_stats.cases) joined to world.geo.json features
via iso-3166-1's ISO_A2 -> ISO_A3 conversion. Markers rendered for
events from the last 24h with non-null lat/lng; size scales with
significance via markerSizePx. Click country or marker to open a
React-rendered popup (createRoot into a detached element) styled
to match the dashboard's surface palette.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Build `TrendChart`

**Files:**
- Create: `components/charts/TrendChart.tsx`

- [ ] **Step 1: Write the chart**

Create `/Users/claude/Projects/project_contagion/components/charts/TrendChart.tsx`:
```tsx
'use client';
import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { Snapshot } from '@/lib/types';
import { Card } from '@/components/ui/Card';

interface Point {
  ts: string;
  cases: number;
}

export function TrendChart({ snapshots }: { snapshots: Snapshot[] }) {
  const points = useMemo<Point[]>(
    () =>
      snapshots
        .filter((s) => s.total_cases != null)
        .map((s) => ({ ts: s.created_at, cases: s.total_cases as number })),
    [snapshots],
  );

  if (points.length < 2) {
    return (
      <Card>
        <h3 className="mb-2 text-sm font-semibold text-text">Cases over time</h3>
        <p className="text-xs leading-relaxed text-text-muted">
          Need at least 2 snapshots for a trend. The pipeline produces one every 1–2 hours.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-text">Cases over time</h3>
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="#2A2A35" strokeDasharray="2 4" />
            <XAxis
              dataKey="ts"
              tickFormatter={(v) => format(parseISO(v), 'MMM d')}
              tick={{ fill: '#8888A0', fontSize: 11 }}
              stroke="#2A2A35"
            />
            <YAxis tick={{ fill: '#8888A0', fontSize: 11 }} stroke="#2A2A35" />
            <Tooltip
              contentStyle={{ background: '#12121A', border: '1px solid #2A2A35', borderRadius: 8 }}
              labelFormatter={(v) => format(parseISO(v as string), 'MMM d, HH:mm')}
            />
            <Line
              type="monotone"
              dataKey="cases"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ r: 3, fill: '#3B82F6' }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npm run typecheck && npm run lint
```

Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/charts/TrendChart.tsx
git commit -m "$(cat <<'EOF'
Add TrendChart: cumulative cases over time

Recharts line chart from snapshots history. With <2 snapshots the
chart hides itself and shows the empty-state copy ("Need at least
2 snapshots..."). Axis ticks/grid styled to the dashboard palette;
animations disabled for snappy re-renders on Realtime updates.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Build `SourceActivityChart`

**Files:**
- Create: `components/charts/SourceActivityChart.tsx`

- [ ] **Step 1: Write the chart**

Create `/Users/claude/Projects/project_contagion/components/charts/SourceActivityChart.tsx`:
```tsx
'use client';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { Event, SourceType } from '@/lib/types';
import { Card } from '@/components/ui/Card';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const LABEL: Record<SourceType, string> = {
  who: 'WHO',
  cdc: 'CDC',
  ecdc: 'ECDC',
  africa_cdc: 'Africa CDC',
  google_news: 'Google',
  reddit: 'Reddit',
  x: 'X',
  bluesky: 'BlueSky',
  wikipedia: 'Wiki',
};

interface BarPoint {
  source: string;
  count: number;
}

export function SourceActivityChart({ events }: { events: Event[] }) {
  const bars = useMemo<BarPoint[]>(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const counts = new Map<SourceType, number>();
    for (const e of events) {
      const ts = new Date(e.occurred_at ?? e.created_at).getTime();
      if (ts < cutoff) continue;
      counts.set(e.source_type, (counts.get(e.source_type) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([source, count]) => ({ source: LABEL[source], count }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  if (bars.length === 0) {
    return (
      <Card data-testid="source-activity-chart">
        <h3 className="mb-2 text-sm font-semibold text-text">Source activity (last 7 days)</h3>
        <p className="text-xs text-text-muted">No source activity in the last 7 days.</p>
      </Card>
    );
  }

  return (
    <Card data-testid="source-activity-chart">
      <h3 className="mb-3 text-sm font-semibold text-text">Source activity (last 7 days)</h3>
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="#2A2A35" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="source" tick={{ fill: '#8888A0', fontSize: 11 }} stroke="#2A2A35" />
            <YAxis tick={{ fill: '#8888A0', fontSize: 11 }} stroke="#2A2A35" allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#12121A', border: '1px solid #2A2A35', borderRadius: 8 }}
              cursor={{ fill: '#1A1A25' }}
            />
            <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npm run typecheck && npm run lint
```

Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/charts/SourceActivityChart.tsx
git commit -m "$(cat <<'EOF'
Add SourceActivityChart: bar chart of events per source

Derives counts internally from the events prop (no extra fetch);
filters to events whose effective timestamp is within the last 7
days, groups by source_type, sorts descending by count. Empty
state when no events match. data-testid='source-activity-chart'
on the wrapper card so the smoke test can assert presence.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Wire `app/page.tsx` and `DashboardClient.tsx`

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/DashboardClient.tsx`

- [ ] **Step 1: Update `app/page.tsx`** to fetch snapshot history

Replace the contents of `/Users/claude/Projects/project_contagion/app/page.tsx`:
```tsx
import { createServerClient } from '@/lib/supabase-server';
import { parseFilters } from '@/lib/filters';
import { DashboardClient } from './DashboardClient';
import type { Event, Snapshot, CountryStat } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Home({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseFilters(searchParams);
  const supabase = createServerClient();

  let eventsQuery = supabase
    .from('events')
    .select('*')
    .eq('disease', 'hantavirus')
    .is('duplicate_of', null);
  if (filters.significance) eventsQuery = eventsQuery.gte('significance', filters.significance);
  if (filters.source) eventsQuery = eventsQuery.eq('source_type', filters.source);
  if (filters.category) eventsQuery = eventsQuery.eq('category', filters.category);
  eventsQuery = eventsQuery.order('created_at', { ascending: false }).range(0, filters.limit - 1);

  const [snapshotRes, snapshotHistoryRes, eventsRes, countriesRes] = await Promise.all([
    supabase
      .from('snapshots')
      .select('*')
      .eq('disease', 'hantavirus')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('snapshots')
      .select('*')
      .eq('disease', 'hantavirus')
      .order('created_at', { ascending: true })
      .limit(30),
    eventsQuery,
    supabase.from('country_stats').select('*').eq('disease', 'hantavirus'),
  ]);

  return (
    <DashboardClient
      initialSnapshot={(snapshotRes.data as Snapshot | null) ?? null}
      initialSnapshotHistory={(snapshotHistoryRes.data as Snapshot[] | null) ?? []}
      initialEvents={(eventsRes.data as Event[] | null) ?? []}
      initialCountries={(countriesRes.data as CountryStat[] | null) ?? []}
      initialFilters={filters}
    />
  );
}
```

- [ ] **Step 2: Update `app/DashboardClient.tsx`** to accept history and render the new panels

Replace the contents of `/Users/claude/Projects/project_contagion/app/DashboardClient.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Event, Snapshot, CountryStat, FilterState } from '@/lib/types';
import { eventMatchesFilter } from '@/lib/filters';
import { getBrowserClient } from '@/lib/supabase-browser';
import { SituationOverview } from '@/components/overview/SituationOverview';
import { FilterBar } from '@/components/feed/FilterBar';
import { EventFeed } from '@/components/feed/EventFeed';
import { CountryBreakdown } from '@/components/country/CountryBreakdown';
import { TrendChart } from '@/components/charts/TrendChart';
import { SourceActivityChart } from '@/components/charts/SourceActivityChart';
import { Skeleton } from '@/components/ui/Skeleton';

const MapPanel = dynamic(
  () => import('@/components/map/MapPanel').then((m) => m.MapPanel),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[280px] w-full rounded-xl" />,
  },
);

interface Props {
  initialSnapshot: Snapshot | null;
  initialSnapshotHistory: Snapshot[];
  initialEvents: Event[];
  initialCountries: CountryStat[];
  initialFilters: FilterState;
}

export function DashboardClient({
  initialSnapshot,
  initialSnapshotHistory,
  initialEvents,
  initialCountries,
  initialFilters,
}: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [snapshotHistory, setSnapshotHistory] = useState(initialSnapshotHistory);
  const [events, setEvents] = useState(initialEvents);
  const [countries, setCountries] = useState(initialCountries);
  const [connected, setConnected] = useState(true);

  useEffect(() => { setSnapshot(initialSnapshot); }, [initialSnapshot]);
  useEffect(() => { setSnapshotHistory(initialSnapshotHistory); }, [initialSnapshotHistory]);
  useEffect(() => { setEvents(initialEvents); }, [initialEvents]);
  useEffect(() => { setCountries(initialCountries); }, [initialCountries]);

  useEffect(() => {
    const supabase = getBrowserClient();

    const eventsChannel = supabase
      .channel('events-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events', filter: 'disease=eq.hantavirus' },
        (payload) => {
          const ev = payload.new as Event;
          if (ev.duplicate_of) return;
          if (!eventMatchesFilter(ev, initialFilters)) return;
          setEvents((prev) => (prev.find((e) => e.id === ev.id) ? prev : [ev, ...prev]));
        },
      )
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'));

    const snapshotChannel = supabase
      .channel('snapshots-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'snapshots', filter: 'disease=eq.hantavirus' },
        (payload) => {
          const s = payload.new as Snapshot;
          setSnapshot(s);
          setSnapshotHistory((prev) =>
            prev.find((p) => p.id === s.id) ? prev : [...prev, s].slice(-30),
          );
        },
      )
      .subscribe();

    const countriesChannel = supabase
      .channel('country-stats-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'country_stats', filter: 'disease=eq.hantavirus' },
        (payload) => {
          const row = (payload.new ?? payload.old) as CountryStat;
          setCountries((prev) => {
            const next = prev.filter((r) => r.country_code !== row.country_code);
            if (payload.eventType !== 'DELETE') next.push(row);
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(snapshotChannel);
      supabase.removeChannel(countriesChannel);
    };
  }, [initialFilters]);

  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-6">
      {!connected && (
        <div className="rounded-md border border-sig-3/40 bg-sig-3/10 px-3 py-2 text-xs text-sig-3">
          Live connection lost. Showing last known data.
        </div>
      )}
      <SituationOverview snapshot={snapshot} />
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,440px)]">
        <div>
          <FilterBar filters={initialFilters} />
          <EventFeed events={events} />
        </div>
        <aside className="flex flex-col gap-4">
          <MapPanel countries={countries} events={events} />
          <TrendChart snapshots={snapshotHistory} />
          <SourceActivityChart events={events} />
        </aside>
      </div>
      <CountryBreakdown rows={countries} />
    </main>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck && npm run lint
```

Expected: both exit 0.

- [ ] **Step 4: Manual smoke**

```bash
./scripts/reset-db.sh
(npm run dev > /tmp/next-dev.log 2>&1 &) && sleep 10 && \
  curl -s http://localhost:3000 | grep -oE 'Need at least 2 snapshots|Source activity|MV Hondius' | sort -u
pkill -f "next dev" 2>/dev/null; sleep 1; true
```

Expected: prints all three terms — chart empty state, source activity heading, and a feed event title.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/DashboardClient.tsx
git commit -m "$(cat <<'EOF'
Wire snapshot history + map + charts into DashboardClient

app/page.tsx adds a 4th parallel fetch (30 most-recent snapshots,
ascending). DashboardClient gains initialSnapshotHistory and
maintains snapshotHistory state alongside current snapshot;
the snapshots Realtime handler appends to history. The aside
placeholder is replaced with MapPanel (dynamic-imported, ssr:false)
+ TrendChart + SourceActivityChart.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Smoke test additions + final verification

**Files:**
- Modify: `tests/dashboard.spec.ts`

- [ ] **Step 1: Extend the smoke spec**

Replace the contents of `/Users/claude/Projects/project_contagion/tests/dashboard.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('dashboard renders MV Hondius outbreak data', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Pathwatch').first()).toBeVisible();

  await expect(page.getByTestId('stat-cases')).toContainText('8');
  await expect(page.getByTestId('stat-deaths')).toContainText('3');
  await expect(page.getByTestId('stat-countries')).toContainText('5');
  await expect(page.getByTestId('stat-fatality')).toContainText(/3[78]/);
  await expect(page.getByTestId('risk-badge')).toContainText(/moderate/i);

  await expect(page.getByText(/MV Hondius/i).first()).toBeVisible();
  await expect(page.getByText('Argentina').first()).toBeVisible();
  await expect(page.getByText('Cape Verde').first()).toBeVisible();
});

test('map and charts render', async ({ page }) => {
  await page.goto('/');

  // MapLibre attribution control is the most reliable map presence assertion
  await expect(page.locator('.maplibregl-ctrl-attrib')).toBeVisible({ timeout: 10_000 });

  // Source activity chart renders (data-testid on the wrapper card)
  await expect(page.getByTestId('source-activity-chart')).toBeVisible();

  // Single-snapshot seed → trend empty state
  await expect(page.getByText(/Need at least 2 snapshots/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the full smoke**

```bash
npm run test:smoke 2>&1 | tail -10
```

Expected: `2 passed (Xs)`.

- [ ] **Step 3: Run full verification**

```bash
npm run lint
npm run typecheck
npm run build
```

Expected: all three exit 0. Build output should show the `/` route still under ~250 KB First Load (MapLibre is dynamic-imported and shouldn't appear in the initial chunk).

- [ ] **Step 4: Confirm git log**

```bash
git log --oneline | head -12
```

Expected: 9 implementation commits + the spec/plan commits + sub-project 2a merge.

- [ ] **Step 5: Commit smoke updates**

```bash
git add tests/dashboard.spec.ts
git commit -m "$(cat <<'EOF'
Extend smoke test for sub-project 2b

Second test asserts the map mounted (MapLibre attribution control
visible), the source activity chart wrapper is present, and the
trend chart's single-snapshot empty state shows. Existing
'dashboard renders MV Hondius outbreak data' test is unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Hand off**

Plan is complete. Use `superpowers:finishing-a-development-branch` to merge or PR.

---

## Verification (full plan complete)

After Task 9, the dashboard:
- Shows the same situation overview / feed / country table as 2a
- Adds a MapLibre choropleth in the right aside, with five colored countries from seed (CL/CH light, AR/NL/CV mid)
- Adds a trend chart card showing the empty-state copy ("Need at least 2 snapshots…")
- Adds a source activity chart with bars for each source represented in the seed (`who`, `cdc`, `ecdc`, `africa_cdc`, `google_news`, `reddit`, `x`, `bluesky`, `wikipedia`)
- Click a colored country → tooltip with cases/deaths/status appears
- `npm run test:smoke` runs both tests and they pass

## Out of scope (next sub-project)

- `/event/[id]` detail page — sub-project 2c
- Vercel deployment + OG image — sub-project 2c
- Mobile bottom-sheet popups — sub-project 2c
- 3D globe — v2
