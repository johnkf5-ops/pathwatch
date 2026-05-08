# Pathwatch Ops Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard at `/` with the Ops Console split-screen layout (top bar + sit-rep stack + tabbed workspace), wire up cases drilldown via slide-in dossier drawer driven by URL state, and ship a `/case/[case_code]` permalink page.

**Architecture:** Wholesale UI rewrite under `components/ops/` and `components/case/` consuming the existing schema (events / snapshots / country_stats / cases / case_locations). Tailwind palette swapped to intel-terminal tokens with backwards-compat aliases so surviving routes (`/event/[id]`, `/about`) inherit the new look without code churn. URL params (`?case=` / `?country=`) drive a side drawer rendered inside the Map tab.

**Tech Stack:** No new deps. Next.js 14 App Router, TypeScript strict, Tailwind v3, MapLibre, supabase-js. Existing 2.5 schema for cases/case_locations.

**Spec:** `docs/superpowers/specs/2026-05-08-pathwatch-ops-console-design.md`

**Prerequisites (verify once before starting):**
- On `main` after sub-project 2.5 merge: `git log --oneline -1` shows the cases-schema merge.
- Local Supabase running with seed: `./scripts/reset-db.sh` succeeds, `psql -c "SELECT count(*) FROM cases"` returns `10`.
- Baseline tests pass: `npm run test:smoke` runs the existing 4 specs green.
- Working directory: `/Users/claude/Projects/project_contagion`.

---

### Task 1: Foundation — Tailwind palette + types + case-helpers

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`
- Modify: `lib/types.ts`
- Create: `lib/case-helpers.ts`

- [ ] **Step 1: Create branch**

```bash
cd /Users/claude/Projects/project_contagion
git checkout -b feat/ops-console
```

- [ ] **Step 2: Replace `tailwind.config.ts`**

Replace `/Users/claude/Projects/project_contagion/tailwind.config.ts` with:

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // intel-terminal palette
        bg: '#07080c',
        'bg-2': '#0b0d13',
        surface: '#10131c',
        'surface-2': '#161a25',
        'surface-3': '#1d2231',
        'surface-hover': '#161a25', // legacy alias = surface-2
        border: '#232a3a',
        'border-soft': '#1a2030',
        'border-strong': '#34405a',
        text: {
          DEFAULT: '#d6dae6',
          secondary: '#8a93a8',
          muted: '#5b6378',
          faint: '#3d4458',
        },
        // signal colors
        green: '#2ee37a',
        amber: '#f5b041',
        orange: '#ff7f3f',
        red: '#ff4d5e',
        cyan: '#4cd6ff',
        violet: '#a78bff',
        accent: '#2ee37a', // accent re-targeted to green for ops feel
        // legacy sig-N aliases used by SignificanceDot / RiskBadge
        sig: {
          1: '#5b6378',
          2: '#2ee37a',
          3: '#f5b041',
          4: '#ff7f3f',
          5: '#ff4d5e',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        // ops-console preference: hard 2px corners
        DEFAULT: '2px',
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 3: Replace `app/globals.css`**

Replace `/Users/claude/Projects/project_contagion/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body {
  background-color: #07080c;
  color: #d6dae6;
}

body {
  font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11', 'ss01';
  background-image:
    radial-gradient(circle at 20% -10%, rgba(46, 227, 122, 0.04), transparent 50%),
    radial-gradient(circle at 90% 10%, rgba(76, 214, 255, 0.03), transparent 40%);
}

/* Map markers pulse */
@keyframes pathwatchPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.6; transform: scale(1.18); }
}

/* LIVE / status dots */
@keyframes pathwatchDotPulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.3; }
}
.dot-pulse { animation: pathwatchDotPulse 1.4s ease-in-out infinite; }

/* MapLibre popup body — match the ops console surface */
.pathwatch-popup .maplibregl-popup-content {
  background: #161a25;
  color: #d6dae6;
  border: 1px solid #232a3a;
  border-radius: 2px;
  padding: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
.pathwatch-popup .maplibregl-popup-tip { border-top-color: #161a25; }
.pathwatch-popup .maplibregl-popup-close-button {
  color: #8a93a8;
  font-size: 18px;
}
```

- [ ] **Step 4: Extend `lib/types.ts`**

Append to `/Users/claude/Projects/project_contagion/lib/types.ts`:

```ts
export type CaseStatus = 'suspected' | 'confirmed' | 'recovered' | 'deceased' | 'critical';
export type CaseRole = 'passenger' | 'crew' | 'contact' | 'healthcare_worker' | 'rural_resident' | 'other';
export type ExposureType = 'rodent_contact' | 'person_to_person' | 'unknown';

export interface Case {
  id: string;
  created_at: string;
  updated_at: string;
  case_code: string;
  disease: string;
  status: CaseStatus;
  is_index_case: boolean;
  role: CaseRole | null;
  exposure_type: ExposureType | null;
  age_range: string | null;
  sex: 'M' | 'F' | 'U' | null;
  exposure_country: string | null;
  exposure_date: string | null;
  onset_date: string | null;
  confirmed_date: string | null;
  outcome_date: string | null;
  current_country: string | null;
  dossier: string | null;
  notes: string | null;
  source_event_id: string | null;
}

export interface CaseLocation {
  id: string;
  case_id: string;
  country_code: string;
  region: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  arrived_at: string;
  departed_at: string | null;
  context: string | null;
  is_exposure_site: boolean;
}
```

- [ ] **Step 5: Write `lib/case-helpers.ts`**

Create `/Users/claude/Projects/project_contagion/lib/case-helpers.ts`:

```ts
import type { Case, CaseLocation, CaseStatus } from './types';

export const STATUS_COLOR: Record<CaseStatus, string> = {
  suspected: '#4cd6ff',
  confirmed: '#f5b041',
  critical: '#ff7f3f',
  deceased: '#ff4d5e',
  recovered: '#2ee37a',
};

export const STATUS_LABEL: Record<CaseStatus, string> = {
  suspected: 'SUSPECTED',
  confirmed: 'CONFIRMED',
  critical: 'CRITICAL',
  deceased: 'DECEASED',
  recovered: 'RECOVERED',
};

export function caseLocationsFor(caseId: string, all: CaseLocation[]): CaseLocation[] {
  return all
    .filter((l) => l.case_id === caseId)
    .sort((a, b) => new Date(a.arrived_at).getTime() - new Date(b.arrived_at).getTime());
}

export function currentLocation(stops: CaseLocation[]): CaseLocation | null {
  if (stops.length === 0) return null;
  const open = stops.filter((s) => !s.departed_at);
  if (open.length > 0) {
    return [...open].sort(
      (a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime(),
    )[0];
  }
  return [...stops].sort(
    (a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime(),
  )[0];
}

export function casesByCountry(
  countryCode: string,
  cases: Case[],
): Case[] {
  return cases.filter(
    (c) => c.current_country === countryCode || c.exposure_country === countryCode,
  );
}
```

- [ ] **Step 6: Verify**

```bash
npm run typecheck && npm run lint
```

Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.ts app/globals.css lib/types.ts lib/case-helpers.ts
git commit -m "$(cat <<'EOF'
Foundation: intel-terminal palette + Case types + helpers

Tailwind colors swapped to the ops-console palette (bg/surface/
text/green/amber/orange/red/cyan/violet) with legacy aliases
(surface-hover, accent, sig-1..5) so surviving components keep
working. globals.css adds the pulse keyframes and ops-console
popup styling. lib/types.ts gains Case + CaseLocation interfaces;
lib/case-helpers.ts has status colors, location ordering, and
casesByCountry filter.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: TopBar + slim layout.tsx

**Files:**
- Create: `components/ops/TopBar.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Write `TopBar.tsx`**

Create `/Users/claude/Projects/project_contagion/components/ops/TopBar.tsx`:

```tsx
import Link from 'next/link';
import type { Snapshot } from '@/lib/types';

const RISK_COLOR: Record<NonNullable<Snapshot['risk_level']>, string> = {
  low: 'text-green border-green',
  moderate: 'text-amber border-amber',
  high: 'text-orange border-orange',
  critical: 'text-red border-red',
};

function utcStamp() {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mn = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yy}-${mm}-${dd} ${hh}:${mn}Z`;
}

export function TopBar({ snapshot }: { snapshot: Snapshot | null }) {
  const risk = snapshot?.risk_level ?? null;
  const fatality = snapshot?.fatality_rate;
  const riskClass = risk ? RISK_COLOR[risk] : 'text-text-muted border-border';
  const riskLabel = risk
    ? `RISK ${risk.toUpperCase()}${fatality != null ? ` · ${(fatality * 100).toFixed(0)}%` : ''}`
    : 'RISK —';

  return (
    <header className="flex h-8 items-center gap-4 border-b border-border bg-bg-2 px-4 font-mono text-[10.5px] uppercase tracking-[0.14em]">
      <Link href="/" className="flex items-center gap-2">
        <span className="inline-flex h-4 w-4 items-center justify-center bg-green text-[10px] font-bold text-bg">P</span>
        <span className="font-bold tracking-[0.16em] text-text">PATHWATCH</span>
      </Link>
      <span className="text-text-muted">OPS CONSOLE</span>
      <span className="flex items-center gap-1.5 text-green">
        <span className="dot-pulse inline-block h-1.5 w-1.5 rounded-full bg-green" />
        LIVE
      </span>
      <span className="ml-auto flex items-center gap-4 text-text-secondary">
        <span>SCOPE GLOBAL</span>
        <span className="border-l border-border pl-4">UTC {utcStamp()}</span>
        <span className={`border-l border-border pl-4 ${riskClass.split(' ')[0]}`}>{riskLabel}</span>
      </span>
    </header>
  );
}
```

- [ ] **Step 2: Slim `app/layout.tsx`**

Replace `/Users/claude/Projects/project_contagion/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Pathwatch — Real-Time Disease Outbreak Tracker',
  description: 'AI-powered real-time tracking of emerging disease outbreaks.',
  openGraph: {
    title: 'Pathwatch — Real-Time Disease Outbreak Tracker',
    description: 'AI-powered real-time tracking of emerging disease outbreaks.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-bg font-sans text-text antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck && npm run lint
```

Expected: both exit 0. (Header / Footer imports remain in layout if not deleted yet — they'll be removed in Task 13. Deleting them now would break the build because DashboardClient still imports them; we'll cut over in Task 11.)

Wait: layout.tsx no longer imports Header/Footer. But the existing `DashboardClient.tsx` does, and `DashboardClient` is what page.tsx renders. So the wrappers are gone from layout but DashboardClient still has its own structure. Visually the page-shell is just the body without header/footer wrappers — until DashboardClient is rewritten in Task 11, the dashboard page may look incomplete/blank. That's expected mid-cycle.

The /event/[id] and /about routes don't render Header/Footer through layout; they have their own back-link UI. They look fine.

- [ ] **Step 4: Commit**

```bash
git add components/ops/TopBar.tsx app/layout.tsx
git commit -m "$(cat <<'EOF'
Add TopBar + drop Header/Footer wrappers from layout

TopBar renders the ops-console chrome: brand block + LIVE pulse +
SCOPE GLOBAL + UTC stamp + risk pill. Static UTC time (rendered
on each request, no live ticker per spec). layout.tsx stops
wrapping children in Header/Footer; the dashboard now owns its
full chrome via DashboardClient (rewritten in a later task).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Sit-rep atoms — SectionHeader, KpiTile, CaseStatusPill, SituationBrief

**Files:**
- Create: `components/ops/SectionHeader.tsx`
- Create: `components/ops/KpiTile.tsx`
- Create: `components/case/CaseStatusPill.tsx`
- Create: `components/ops/SituationBrief.tsx`

- [ ] **Step 1: Write `SectionHeader.tsx`**

Create `/Users/claude/Projects/project_contagion/components/ops/SectionHeader.tsx`:

```tsx
import { cn } from '@/lib/utils';

export function SectionHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        'font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-text-secondary',
        className,
      )}
    >
      {children}
    </h2>
  );
}
```

- [ ] **Step 2: Write `KpiTile.tsx`**

Create `/Users/claude/Projects/project_contagion/components/ops/KpiTile.tsx`:

```tsx
import { cn } from '@/lib/utils';

type Tone = 'good' | 'bad' | 'neutral';

const DELTA_COLOR: Record<Tone, string> = {
  good: 'text-green',
  bad: 'text-red',
  neutral: 'text-text-muted',
};

export interface KpiTileProps {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: Tone;
  testId?: string;
}

export function KpiTile({ label, value, delta, deltaTone = 'neutral', testId }: KpiTileProps) {
  return (
    <div className="flex flex-col gap-1 border border-border bg-surface p-3" data-testid={testId}>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-muted">{label}</div>
      <div className="font-mono text-[22px] font-bold leading-none tabular-nums text-text">{value}</div>
      {delta && (
        <div className={cn('font-mono text-[10.5px] tabular-nums', DELTA_COLOR[deltaTone])}>{delta}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write `CaseStatusPill.tsx`**

Create `/Users/claude/Projects/project_contagion/components/case/CaseStatusPill.tsx`:

```tsx
import type { CaseStatus } from '@/lib/types';
import { STATUS_LABEL } from '@/lib/case-helpers';

const PILL: Record<CaseStatus, string> = {
  suspected: 'border-cyan text-cyan',
  confirmed: 'border-amber text-amber',
  critical: 'border-orange text-orange',
  deceased: 'border-red text-red',
  recovered: 'border-green text-green',
};

export function CaseStatusPill({ status }: { status: CaseStatus }) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] ${PILL[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
```

- [ ] **Step 4: Write `SituationBrief.tsx`**

Create `/Users/claude/Projects/project_contagion/components/ops/SituationBrief.tsx`:

```tsx
import { formatDistanceToNow, parseISO } from 'date-fns';
import type { Snapshot } from '@/lib/types';
import { SectionHeader } from './SectionHeader';

export function SituationBrief({ snapshot }: { snapshot: Snapshot | null }) {
  if (!snapshot) {
    return (
      <section className="border-b border-border px-4 py-4">
        <SectionHeader>SITUATION BRIEF</SectionHeader>
        <p className="mt-2 text-sm text-text-muted">Awaiting first snapshot.</p>
      </section>
    );
  }

  const headline = snapshot.trend_description ?? 'Outbreak status updated.';
  const fresh = formatDistanceToNow(parseISO(snapshot.created_at), { addSuffix: true }).toUpperCase();

  return (
    <section className="border-b border-border px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader>SITUATION BRIEF</SectionHeader>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-green">
          <span className="dot-pulse inline-block h-1.5 w-1.5 rounded-full bg-green" />
          {fresh}
        </span>
      </div>
      <h3 className="mt-2 font-mono text-[22px] font-bold leading-tight tracking-[-0.01em] text-text">
        {headline}
      </h3>
      {snapshot.ai_analysis && (
        <p className="mt-3 max-w-[60ch] text-[13px] leading-[1.5] text-text-secondary">
          {snapshot.ai_analysis}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Verify**

```bash
npm run typecheck && npm run lint
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add components/ops/SectionHeader.tsx components/ops/KpiTile.tsx components/case/CaseStatusPill.tsx components/ops/SituationBrief.tsx
git commit -m "$(cat <<'EOF'
Add ops sit-rep atoms (SectionHeader, KpiTile, status pill, brief)

Mono-uppercase SectionHeader matches the ops-console label spec.
KpiTile renders 9.5px label + 22/700 value + optional delta tinted
by tone (up-is-bad -> red; up-is-good -> green; neutral -> muted).
CaseStatusPill colors the case status (suspected=cyan, confirmed=
amber, critical=orange, deceased=red, recovered=green).
SituationBrief consumes a Snapshot, headlines from trend_description,
expands ai_analysis paragraph; right-aligned freshness pill in green.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: KpiGrid + PostureMatrix

**Files:**
- Create: `components/ops/KpiGrid.tsx`
- Create: `components/ops/PostureMatrix.tsx`

- [ ] **Step 1: Write `KpiGrid.tsx`**

Create `/Users/claude/Projects/project_contagion/components/ops/KpiGrid.tsx`:

```tsx
import type { Snapshot } from '@/lib/types';
import { formatNumber, formatPercent } from '@/lib/format';
import { SectionHeader } from './SectionHeader';
import { KpiTile } from './KpiTile';

function delta(curr: number | null | undefined, prev: number | null | undefined, unit: 'abs' | 'pct' | 'pp'): {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
} {
  if (curr == null || prev == null) return { text: '—', tone: 'neutral' };
  const d = curr - prev;
  if (d === 0) return { text: '— 0', tone: 'neutral' };
  const arrow = d > 0 ? '▲' : '▼';
  const tone: 'good' | 'bad' | 'neutral' = unit === 'abs' || unit === 'pct'
    ? d > 0 ? 'bad' : 'good'
    : d > 0 ? 'bad' : 'good';
  if (unit === 'abs') return { text: `${arrow} ${d > 0 ? '+' : ''}${d}`, tone };
  if (unit === 'pp') return { text: `${arrow} ${d > 0 ? '+' : ''}${(d * 100).toFixed(1)}pp`, tone };
  const pct = prev === 0 ? 0 : (d / prev) * 100;
  return { text: `${arrow} ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, tone };
}

export function KpiGrid({
  snapshot,
  prevSnapshot,
}: {
  snapshot: Snapshot | null;
  prevSnapshot: Snapshot | null;
}) {
  const cases = snapshot?.total_cases ?? null;
  const deaths = snapshot?.total_deaths ?? null;
  const cfr = snapshot?.fatality_rate ?? null;
  const countries = snapshot?.countries_affected ?? null;
  const dCases = delta(cases, prevSnapshot?.total_cases, 'pct');
  const dDeaths = delta(deaths, prevSnapshot?.total_deaths, 'pct');
  const dCfr = delta(cfr, prevSnapshot?.fatality_rate, 'pp');
  const dCountries = delta(countries, prevSnapshot?.countries_affected, 'abs');

  return (
    <section className="border-b border-border px-4 py-4">
      <SectionHeader>KEY METRICS</SectionHeader>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KpiTile testId="kpi-cases" label="CASES" value={formatNumber(cases)} delta={dCases.text} deltaTone={dCases.tone} />
        <KpiTile testId="kpi-deaths" label="DEATHS" value={formatNumber(deaths)} delta={dDeaths.text} deltaTone={dDeaths.tone} />
        <KpiTile testId="kpi-cfr" label="CFR" value={formatPercent(cfr)} delta={dCfr.text} deltaTone={dCfr.tone} />
        <KpiTile testId="kpi-countries" label="COUNTRIES" value={formatNumber(countries)} delta={dCountries.text} deltaTone={{ good: 'neutral', bad: 'neutral', neutral: 'neutral' }[dCountries.tone] as 'neutral'} />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `PostureMatrix.tsx`**

Create `/Users/claude/Projects/project_contagion/components/ops/PostureMatrix.tsx`:

```tsx
import type { CountryStat } from '@/lib/types';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { formatNumber } from '@/lib/format';
import { SectionHeader } from './SectionHeader';

const STATUS_TAG: Record<NonNullable<CountryStat['status']>, string> = {
  active: 'text-red',
  contained: 'text-amber',
  monitoring: 'text-green',
  clear: 'text-text-muted',
};

function intensity(value: number, kind: 'cases' | 'deaths'): string {
  if (value <= 0) return 'transparent';
  const buckets = kind === 'cases' ? [1, 2, 4, 10] : [0, 1, 2, 5];
  if (value >= buckets[3]) return 'rgba(255,77,94,0.45)';
  if (value >= buckets[2]) return 'rgba(255,127,63,0.32)';
  if (value >= buckets[1]) return 'rgba(245,176,65,0.22)';
  return 'rgba(46,227,122,0.12)';
}

function dark(value: number, kind: 'cases' | 'deaths'): boolean {
  const buckets = kind === 'cases' ? [10] : [5];
  return value >= buckets[0];
}

export function PostureMatrix({ countries }: { countries: CountryStat[] }) {
  if (countries.length === 0) {
    return (
      <section className="border-b border-border px-4 py-4">
        <SectionHeader>REGIONAL POSTURE</SectionHeader>
        <p className="mt-2 text-sm text-text-muted">No country data yet.</p>
      </section>
    );
  }

  const sorted = [...countries].sort((a, b) => b.cases - a.cases);

  return (
    <section className="border-b border-border px-4 py-4">
      <SectionHeader>REGIONAL POSTURE</SectionHeader>
      <table className="mt-3 w-full font-mono text-[11.5px]">
        <thead className="text-text-muted">
          <tr className="border-b border-border-soft">
            <th className="px-2 py-1 text-left font-medium">COUNTRY</th>
            <th className="px-2 py-1 text-right font-medium">CASES</th>
            <th className="px-2 py-1 text-right font-medium">DEATHS</th>
            <th className="px-2 py-1 text-left font-medium">STATUS</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.id} className="border-b border-border-soft last:border-0">
              <td className="px-2 py-1.5">
                <span className="mr-2"><CountryFlag code={c.country_code} /></span>
                <span className="text-text">{c.country_name}</span>
              </td>
              <td
                className="px-2 py-1.5 text-right tabular-nums"
                style={{ background: intensity(c.cases, 'cases'), color: dark(c.cases, 'cases') ? '#0b0d13' : undefined }}
              >
                {formatNumber(c.cases)}
              </td>
              <td
                className="px-2 py-1.5 text-right tabular-nums"
                style={{ background: intensity(c.deaths, 'deaths'), color: dark(c.deaths, 'deaths') ? '#0b0d13' : undefined }}
              >
                {formatNumber(c.deaths)}
              </td>
              <td className={`px-2 py-1.5 ${c.status ? STATUS_TAG[c.status] : 'text-text-muted'}`}>
                {c.status ? c.status.toUpperCase() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
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
git add components/ops/KpiGrid.tsx components/ops/PostureMatrix.tsx
git commit -m "$(cat <<'EOF'
Add KpiGrid + PostureMatrix sit-rep panels

KpiGrid renders cases/deaths/CFR/countries with deltas vs the
previous snapshot (up-is-bad tone for cases/deaths/CFR; neutral
for countries). PostureMatrix is a compact dense table — country
flag + name, heat-bucketed cases and deaths cells, status tag in
its signal color. Sorted by case count desc.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Watchlist + WatchlistItem

**Files:**
- Create: `components/ops/Watchlist.tsx`
- Create: `components/ops/WatchlistItem.tsx`

- [ ] **Step 1: Write `WatchlistItem.tsx`**

Create `/Users/claude/Projects/project_contagion/components/ops/WatchlistItem.tsx`:

```tsx
import Link from 'next/link';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import type { Event } from '@/lib/types';

const SOURCE_LABEL: Record<Event['source_type'], string> = {
  who: 'WHO',
  cdc: 'CDC',
  ecdc: 'ECDC',
  africa_cdc: 'AFRICA CDC',
  google_news: 'GOOGLE',
  reddit: 'REDDIT',
  x: 'X',
  bluesky: 'BLUESKY',
  wikipedia: 'WIKI',
};

function tagFor(sig: Event['significance']): { text: string; cls: string } | null {
  if (sig === 5) return { text: 'ALERT', cls: 'border-red text-red' };
  if (sig === 4) return { text: 'WATCH', cls: 'border-orange text-orange' };
  return null;
}

export function WatchlistItem({ event }: { event: Event }) {
  const tag = tagFor(event.significance);
  const age = formatDistanceToNowStrict(parseISO(event.occurred_at ?? event.created_at)).toUpperCase();
  return (
    <li>
      <Link href={`/event/${event.id}`} className="block border-b border-border-soft py-2 last:border-0 hover:bg-surface-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em]">
          <span className="text-text-muted">{age}</span>
          <span className="text-text-secondary">{SOURCE_LABEL[event.source_type]}</span>
          {tag && <span className={`ml-auto border px-1.5 py-0.5 ${tag.cls}`}>{tag.text}</span>}
        </div>
        <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-text">{event.title}</p>
      </Link>
    </li>
  );
}
```

- [ ] **Step 2: Write `Watchlist.tsx`**

Create `/Users/claude/Projects/project_contagion/components/ops/Watchlist.tsx`:

```tsx
import type { Event } from '@/lib/types';
import { SectionHeader } from './SectionHeader';
import { WatchlistItem } from './WatchlistItem';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function Watchlist({ events }: { events: Event[] }) {
  const cutoff = Date.now() - ONE_DAY_MS;
  const top = events
    .filter((e) => new Date(e.occurred_at ?? e.created_at).getTime() >= cutoff)
    .sort((a, b) => {
      if (a.significance !== b.significance) return b.significance - a.significance;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, 5);

  return (
    <section className="px-4 py-4">
      <SectionHeader>WATCHLIST</SectionHeader>
      {top.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">No alerts in the last 24 hours.</p>
      ) : (
        <ul className="mt-2">
          {top.map((e) => (
            <WatchlistItem key={e.id} event={e} />
          ))}
        </ul>
      )}
    </section>
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
git add components/ops/Watchlist.tsx components/ops/WatchlistItem.tsx
git commit -m "$(cat <<'EOF'
Add Watchlist + WatchlistItem (top 5 events from last 24h)

Filters client-side to events whose effective timestamp is within
24h, sorts by significance desc then created_at desc, slices top 5.
Each item is a Link to /event/[id]. Sig-5 items get an ALERT tag
in red; sig-4 get WATCH in orange; below get no tag.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: TabStrip + ByCountryPane

**Files:**
- Create: `components/ops/TabStrip.tsx`
- Create: `components/ops/ByCountryPane.tsx`

- [ ] **Step 1: Write `TabStrip.tsx`**

Create `/Users/claude/Projects/project_contagion/components/ops/TabStrip.tsx`:

```tsx
'use client';
import { cn } from '@/lib/utils';

export interface Tab {
  id: string;
  label: string;
  count?: number;
}

export function TabStrip({
  tabs,
  active,
  onChange,
}: {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" className="flex border-b border-border bg-bg-2 font-mono text-[10.5px] uppercase tracking-[0.1em]">
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 transition-colors',
              isActive
                ? 'border-b-2 border-green bg-surface text-text'
                : 'text-text-muted hover:text-text',
            )}
          >
            <span>{t.label}</span>
            {t.count != null && (
              <span className="rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] text-text-secondary">
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Write `ByCountryPane.tsx`**

Create `/Users/claude/Projects/project_contagion/components/ops/ByCountryPane.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { CountryStat } from '@/lib/types';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { formatNumber } from '@/lib/format';

const STATUS_TAG: Record<NonNullable<CountryStat['status']>, string> = {
  active: 'text-red',
  contained: 'text-amber',
  monitoring: 'text-green',
  clear: 'text-text-muted',
};

type SortKey = 'country_name' | 'cases' | 'deaths' | 'first_case_date' | 'latest_case_date';

export function ByCountryPane({ rows }: { rows: CountryStat[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'cases',
    dir: 'desc',
  });

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return sort.dir === 'asc' ? -1 : 1;
    if (av > bv) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  function header(key: SortKey, label: string, align: 'left' | 'right' = 'left') {
    const active = sort.key === key;
    return (
      <th className={`px-3 py-2 text-${align} font-medium`}>
        <button
          className="inline-flex items-center gap-1 hover:text-text"
          onClick={() =>
            setSort((s) =>
              s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' },
            )
          }
        >
          {label}
          {active && (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
        </button>
      </th>
    );
  }

  function selectCountry(code: string) {
    const u = new URLSearchParams(searchParams.toString());
    u.delete('case');
    u.set('country', code);
    router.replace(`${pathname}?${u.toString()}`);
  }

  return (
    <div className="overflow-y-auto">
      <table className="w-full font-mono text-[11.5px]">
        <thead className="border-b border-border text-text-muted">
          <tr>
            <th className="px-3 py-2 text-left font-medium">FLAG</th>
            {header('country_name', 'COUNTRY')}
            {header('cases', 'CASES', 'right')}
            {header('deaths', 'DEATHS', 'right')}
            <th className="px-3 py-2 text-left font-medium">STATUS</th>
            {header('first_case_date', 'FIRST')}
            {header('latest_case_date', 'LATEST')}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.id}
              className="cursor-pointer border-b border-border-soft last:border-0 hover:bg-surface-2"
              onClick={() => selectCountry(r.country_code)}
            >
              <td className="px-3 py-2"><CountryFlag code={r.country_code} /></td>
              <td className="px-3 py-2 text-text">{r.country_name}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.cases)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.deaths)}</td>
              <td className={`px-3 py-2 ${r.status ? STATUS_TAG[r.status] : 'text-text-muted'}`}>
                {r.status ? r.status.toUpperCase() : '—'}
              </td>
              <td className="px-3 py-2 text-text-secondary">{r.first_case_date ?? '—'}</td>
              <td className="px-3 py-2 text-text-secondary">{r.latest_case_date ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
git add components/ops/TabStrip.tsx components/ops/ByCountryPane.tsx
git commit -m "$(cat <<'EOF'
Add TabStrip + ByCountryPane for the workspace right column

TabStrip renders mono-uppercase tab buttons with optional count
chips; active tab gets a green underline + surface bg. ByCountryPane
is a sortable mono table; click row pushes ?country=<code> so the
DossierDrawer (next tasks) can show the country detail when the
user switches back to the Map tab.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Map extensions — case markers, click → URL state, TravelPathLayer

**Files:**
- Modify: `components/map/MapPanel.tsx`
- Create: `components/map/TravelPathLayer.tsx`
- Create: `components/ops/MapPane.tsx`

- [ ] **Step 1: Replace `MapPanel.tsx` with case-marker version**

Replace `/Users/claude/Projects/project_contagion/components/map/MapPanel.tsx`:

```tsx
'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import maplibregl, { type Map as MlMap, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { CountryStat, Case, CaseLocation } from '@/lib/types';
import { caseBucket, BUCKET_COLOR } from '@/lib/map-colors';
import { STATUS_COLOR, caseLocationsFor, currentLocation } from '@/lib/case-helpers';

const TILE_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface Props {
  countries: CountryStat[];
  cases: Case[];
  caseLocations: CaseLocation[];
  selectedCaseId?: string | null;
}

export function MapPanel({ countries, cases, caseLocations, selectedCaseId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const iso2ToBucket = useMemo(() => {
    const m = new Map<string, ReturnType<typeof caseBucket>>();
    for (const c of countries) m.set(c.country_code, caseBucket(c.cases));
    return m;
  }, [countries]);

  const caseMarkers = useMemo(() => {
    return cases
      .map((c) => {
        const loc = currentLocation(caseLocationsFor(c.id, caseLocations));
        if (!loc?.latitude || !loc?.longitude) return null;
        return { case: c, lat: loc.latitude, lon: loc.longitude };
      })
      .filter((x): x is { case: Case; lat: number; lon: number } => x !== null);
  }, [cases, caseLocations]);

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
      for (const f of geo.features) {
        const iso2 = f.properties?.ISO_A2 ?? f.properties?.ISO_A2_EH;
        f.properties.bucket = iso2 ? (iso2ToBucket.get(iso2) ?? 'none') : 'none';
        f.properties.iso2 = iso2;
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
          'fill-opacity': 0.45,
        },
      });
      map.on('click', 'countries-fill', (e) => {
        const iso2 = e.features?.[0]?.properties?.iso2 as string | undefined;
        if (!iso2) return;
        const u = new URLSearchParams(searchParams.toString());
        u.delete('case');
        u.set('country', iso2);
        router.replace(`${pathname}?${u.toString()}`);
      });
      map.on('mouseenter', 'countries-fill', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'countries-fill', () => (map.getCanvas().style.cursor = ''));
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update choropleth on countries change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getSource('countries')) return;
    const src = map.getSource('countries') as GeoJSONSource;
    fetch('/world.geo.json')
      .then((r) => r.json())
      .then((geo) => {
        for (const f of geo.features) {
          const iso2 = f.properties?.ISO_A2 ?? f.properties?.ISO_A2_EH;
          f.properties.bucket = iso2 ? (iso2ToBucket.get(iso2) ?? 'none') : 'none';
          f.properties.iso2 = iso2;
        }
        src.setData(geo);
      });
  }, [iso2ToBucket]);

  // Render case markers (declarative replace)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers: maplibregl.Marker[] = [];

    function attach() {
      for (const m of caseMarkers) {
        const el = document.createElement('div');
        const isSelected = selectedCaseId === m.case.id;
        const color = STATUS_COLOR[m.case.status];
        const size = isSelected ? 18 : 12;
        el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};box-shadow:0 0 0 ${isSelected ? '5' : '3'}px ${color}33;cursor:pointer;${m.case.status === 'critical' || isSelected ? 'animation:pathwatchPulse 1.6s infinite;' : ''}${m.case.is_index_case ? `border:1px solid #d6dae6;` : ''}`;
        el.title = `${m.case.case_code} · ${m.case.status.toUpperCase()}`;
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([m.lon, m.lat])
          .addTo(map);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const u = new URLSearchParams(searchParams.toString());
          u.delete('country');
          u.set('case', m.case.case_code);
          router.replace(`${pathname}?${u.toString()}`);
        });
        markers.push(marker);
      }
    }

    if (map.loaded()) attach();
    else map.once('load', attach);

    return () => markers.forEach((mk) => mk.remove());
  }, [caseMarkers, selectedCaseId, pathname, router, searchParams]);

  return <div ref={containerRef} className="h-full w-full" />;
}
```

- [ ] **Step 2: Write `TravelPathLayer.tsx`**

Create `/Users/claude/Projects/project_contagion/components/map/TravelPathLayer.tsx`:

```tsx
'use client';
import { useEffect } from 'react';
import type { Map as MlMap } from 'maplibre-gl';
import type { Case, CaseLocation } from '@/lib/types';
import { caseLocationsFor, STATUS_COLOR } from '@/lib/case-helpers';

const SOURCE_ID = 'pathwatch-travel-path';
const LINE_LAYER_ID = 'pathwatch-travel-path-line';
const POINTS_LAYER_ID = 'pathwatch-travel-path-points';

export function TravelPathLayer({
  map,
  case_,
  locations,
}: {
  map: MlMap | null;
  case_: Case;
  locations: CaseLocation[];
}) {
  useEffect(() => {
    if (!map) return;

    const stops = caseLocationsFor(case_.id, locations).filter(
      (l) => l.latitude != null && l.longitude != null,
    );
    if (stops.length < 1) return;

    const lineCoords = stops.map((s) => [s.longitude as number, s.latitude as number]);
    const featureCollection = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: { type: 'LineString' as const, coordinates: lineCoords },
          properties: { case_id: case_.id },
        },
        ...stops.map((s, i) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [s.longitude as number, s.latitude as number] },
          properties: { stop: i + 1, case_id: case_.id },
        })),
      ],
    };

    const color = STATUS_COLOR[case_.status];

    const apply = () => {
      if (map.getSource(SOURCE_ID)) {
        const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
        src.setData(featureCollection);
      } else {
        map.addSource(SOURCE_ID, { type: 'geojson', data: featureCollection });
        map.addLayer({
          id: LINE_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          filter: ['==', ['geometry-type'], 'LineString'],
          paint: { 'line-color': color, 'line-width': 2, 'line-dasharray': [3, 2], 'line-opacity': 0.9 },
        });
        map.addLayer({
          id: POINTS_LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: { 'circle-radius': 5, 'circle-color': color, 'circle-stroke-color': '#0b0d13', 'circle-stroke-width': 2 },
        });
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);

    return () => {
      if (!map) return;
      if (map.getLayer(POINTS_LAYER_ID)) map.removeLayer(POINTS_LAYER_ID);
      if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
  }, [map, case_, locations]);

  return null;
}
```

(Note: `TravelPathLayer` requires access to the `MapLibre` `map` instance. Since `MapPanel` keeps the map instance internal, the path layer is effectively sketched here for future integration. For v1 we wire it in directly inside `MapPanel` rather than as a separate component. Drop the import and integrate the path-rendering logic into `MapPanel` itself in **Step 3** below.)

- [ ] **Step 3: Inline travel-path drawing into `MapPanel.tsx`**

Add a 4th `useEffect` to `MapPanel.tsx` (after the case-markers effect) that draws the travel path for `selectedCaseId`. Append inside the `MapPanel` component, before the `return`:

```tsx
  // Travel path for selected case
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const SOURCE_ID = 'pathwatch-travel-path';
    const LINE_LAYER_ID = 'pathwatch-travel-path-line';
    const POINTS_LAYER_ID = 'pathwatch-travel-path-points';

    const cleanup = () => {
      if (map.getLayer(POINTS_LAYER_ID)) map.removeLayer(POINTS_LAYER_ID);
      if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };

    if (!selectedCaseId) {
      if (map.isStyleLoaded()) cleanup();
      return cleanup;
    }

    const sel = cases.find((c) => c.id === selectedCaseId);
    if (!sel) return cleanup;
    const stops = caseLocationsFor(sel.id, caseLocations).filter(
      (l) => l.latitude != null && l.longitude != null,
    );
    if (stops.length < 1) return cleanup;
    const color = STATUS_COLOR[sel.status];
    const lineCoords = stops.map((s) => [s.longitude as number, s.latitude as number]);
    const fc = {
      type: 'FeatureCollection' as const,
      features: [
        { type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: lineCoords }, properties: {} },
        ...stops.map((s, i) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [s.longitude as number, s.latitude as number] },
          properties: { stop: i + 1 },
        })),
      ],
    };
    const apply = () => {
      cleanup();
      map.addSource(SOURCE_ID, { type: 'geojson', data: fc });
      map.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': color, 'line-width': 2, 'line-dasharray': [3, 2], 'line-opacity': 0.9 },
      });
      map.addLayer({
        id: POINTS_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-radius': 5, 'circle-color': color, 'circle-stroke-color': '#0b0d13', 'circle-stroke-width': 2 },
      });
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);

    return cleanup;
  }, [selectedCaseId, cases, caseLocations]);
```

(With this in place, `components/map/TravelPathLayer.tsx` from Step 2 is unused. Delete it.)

```bash
rm /Users/claude/Projects/project_contagion/components/map/TravelPathLayer.tsx
```

- [ ] **Step 4: Write `MapPane.tsx`**

Create `/Users/claude/Projects/project_contagion/components/ops/MapPane.tsx`:

```tsx
'use client';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/Skeleton';
import type { CountryStat, Case, CaseLocation } from '@/lib/types';

const MapPanel = dynamic(
  () => import('@/components/map/MapPanel').then((m) => m.MapPanel),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full" />,
  },
);

export function MapPane({
  countries,
  cases,
  caseLocations,
  selectedCaseId,
}: {
  countries: CountryStat[];
  cases: Case[];
  caseLocations: CaseLocation[];
  selectedCaseId: string | null;
}) {
  return (
    <div className="absolute inset-0">
      <MapPanel
        countries={countries}
        cases={cases}
        caseLocations={caseLocations}
        selectedCaseId={selectedCaseId}
      />
    </div>
  );
}
```

- [ ] **Step 5: Verify**

```bash
npm run typecheck && npm run lint
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add components/map/MapPanel.tsx components/ops/MapPane.tsx
git commit -m "$(cat <<'EOF'
Map: case markers + click->URL + travel path on selected case

MapPanel now renders one marker per case at its current location
(latest case_locations row), color-coded by status. Click a marker
pushes ?case=<code> to the URL. Click country polygon pushes
?country=<iso2>. Selected case markers grow + pulse, get a 5px
shadow ring; index cases get a thin text-color border ring. A
4th effect draws the selected case's travel path (dashed line +
numbered points) and tears down on unselect/unmount. MapPane wraps
MapPanel with a dynamic import (ssr:false) so MapLibre stays out
of the SSR bundle.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: CaseDossier + TravelTimeline

**Files:**
- Create: `components/case/TravelTimeline.tsx`
- Create: `components/case/CaseDossier.tsx`

- [ ] **Step 1: Write `TravelTimeline.tsx`**

Create `/Users/claude/Projects/project_contagion/components/case/TravelTimeline.tsx`:

```tsx
import { format, parseISO } from 'date-fns';
import type { CaseLocation } from '@/lib/types';
import { CountryFlag } from '@/components/ui/CountryFlag';

export function TravelTimeline({ stops }: { stops: CaseLocation[] }) {
  if (stops.length === 0) {
    return <p className="text-sm text-text-muted">No travel data.</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {stops.map((s, i) => {
        const arrived = format(parseISO(s.arrived_at), 'MMM d');
        const departed = s.departed_at ? format(parseISO(s.departed_at), 'MMM d') : 'PRESENT';
        return (
          <li key={s.id} className="flex gap-3 border-l border-border-soft pl-3">
            <div className="flex flex-col">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
                STOP {i + 1} · {arrived} → {departed}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-sm text-text">
                <CountryFlag code={s.country_code} />
                <span>{s.location_name ?? s.country_code}</span>
                {s.is_exposure_site && (
                  <span className="ml-2 border border-red px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-red">
                    EXPOSURE
                  </span>
                )}
              </span>
              {s.context && <span className="mt-0.5 text-xs text-text-secondary">{s.context}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2: Write `CaseDossier.tsx`**

Create `/Users/claude/Projects/project_contagion/components/case/CaseDossier.tsx`:

```tsx
import Link from 'next/link';
import type { Case, CaseLocation, Event } from '@/lib/types';
import { caseLocationsFor } from '@/lib/case-helpers';
import { CaseStatusPill } from './CaseStatusPill';
import { TravelTimeline } from './TravelTimeline';
import { SectionHeader } from '@/components/ops/SectionHeader';

export function CaseDossier({
  case_,
  locations,
  sourceEvent,
  showOpenLink = false,
}: {
  case_: Case;
  locations: CaseLocation[];
  sourceEvent?: Event | null;
  showOpenLink?: boolean;
}) {
  const stops = caseLocationsFor(case_.id, locations);
  const meta = [case_.role?.toUpperCase().replace('_', ' '), case_.age_range, case_.sex]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="flex flex-col gap-4 p-4">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-mono text-[22px] font-bold leading-tight tracking-[-0.01em] text-text">
            {case_.case_code}
          </h1>
          <CaseStatusPill status={case_.status} />
        </div>
        {meta && (
          <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-muted">
            {meta}{case_.is_index_case ? ' · INDEX CASE' : ''}
          </div>
        )}
      </header>

      {case_.dossier && (
        <section>
          <SectionHeader>DOSSIER</SectionHeader>
          <p className="mt-2 text-sm leading-[1.55] text-text-secondary">{case_.dossier}</p>
        </section>
      )}

      <section>
        <SectionHeader>KEY DATES</SectionHeader>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11.5px]">
          <dt className="text-text-muted">EXPOSURE</dt>
          <dd className="tabular-nums text-text">{case_.exposure_date ?? '—'}</dd>
          <dt className="text-text-muted">ONSET</dt>
          <dd className="tabular-nums text-text">{case_.onset_date ?? '—'}</dd>
          <dt className="text-text-muted">CONFIRMED</dt>
          <dd className="tabular-nums text-text">{case_.confirmed_date ?? '—'}</dd>
          <dt className="text-text-muted">OUTCOME</dt>
          <dd className="tabular-nums text-text">{case_.outcome_date ?? '—'}</dd>
        </dl>
      </section>

      <section>
        <SectionHeader>TRAVEL TIMELINE</SectionHeader>
        <div className="mt-3"><TravelTimeline stops={stops} /></div>
      </section>

      {sourceEvent && (
        <section>
          <SectionHeader>LINKED EVENT</SectionHeader>
          <Link
            href={`/event/${sourceEvent.id}`}
            className="mt-2 block text-sm leading-snug text-accent hover:underline"
          >
            {sourceEvent.title} ↗
          </Link>
        </section>
      )}

      {showOpenLink && (
        <Link
          href={`/case/${case_.case_code}`}
          className="self-start font-mono text-[10.5px] uppercase tracking-[0.1em] text-accent hover:underline"
        >
          OPEN PERMALINK ↗
        </Link>
      )}
    </article>
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
git add components/case/TravelTimeline.tsx components/case/CaseDossier.tsx
git commit -m "$(cat <<'EOF'
Add CaseDossier + TravelTimeline (used by drawer + permalink page)

CaseDossier renders case_code as the headline + status pill,
role/age/sex meta line, narrative dossier, key dates grid, full
TravelTimeline (ordered stops with arrived->departed labels and
EXPOSURE flags), and an optional 'OPEN PERMALINK' link to
/case/[case_code]. TravelTimeline draws one stop per row with
left-border accent and stop number labels.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: DossierDrawer

**Files:**
- Create: `components/ops/DossierDrawer.tsx`

- [ ] **Step 1: Write `DossierDrawer.tsx`**

Create `/Users/claude/Projects/project_contagion/components/ops/DossierDrawer.tsx`:

```tsx
'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import Link from 'next/link';
import type { Case, CaseLocation, CountryStat, Event } from '@/lib/types';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { CaseStatusPill } from '@/components/case/CaseStatusPill';
import { CaseDossier } from '@/components/case/CaseDossier';
import { SectionHeader } from './SectionHeader';
import { casesByCountry } from '@/lib/case-helpers';

export function DossierDrawer({
  cases,
  caseLocations,
  countries,
  events,
  caseCode,
  countryCode,
}: {
  cases: Case[];
  caseLocations: CaseLocation[];
  countries: CountryStat[];
  events: Event[];
  caseCode: string | null;
  countryCode: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const open = caseCode != null || countryCode != null;

  function close() {
    const u = new URLSearchParams(searchParams.toString());
    u.delete('case');
    u.delete('country');
    const qs = u.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  let body: React.ReactNode = null;
  if (caseCode) {
    const c = cases.find((x) => x.case_code === caseCode);
    if (c) {
      const sourceEvent = c.source_event_id
        ? events.find((e) => e.id === c.source_event_id) ?? null
        : null;
      body = <CaseDossier case_={c} locations={caseLocations} sourceEvent={sourceEvent} showOpenLink />;
    } else {
      body = <p className="p-4 text-sm text-text-muted">Case {caseCode} not found.</p>;
    }
  } else if (countryCode) {
    const country = countries.find((c) => c.country_code === countryCode);
    const list = casesByCountry(countryCode, cases);
    body = (
      <div className="flex flex-col gap-4 p-4">
        <header className="flex items-center gap-2">
          <CountryFlag code={countryCode} className="text-2xl" />
          <h1 className="font-mono text-[22px] font-bold leading-tight text-text">
            {country?.country_name ?? countryCode}
          </h1>
        </header>
        {country && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11.5px]">
            <dt className="text-text-muted">CASES</dt>
            <dd className="tabular-nums text-text">{country.cases}</dd>
            <dt className="text-text-muted">DEATHS</dt>
            <dd className="tabular-nums text-text">{country.deaths}</dd>
            <dt className="text-text-muted">STATUS</dt>
            <dd className="text-text">{country.status?.toUpperCase() ?? '—'}</dd>
            <dt className="text-text-muted">FIRST</dt>
            <dd className="text-text">{country.first_case_date ?? '—'}</dd>
            <dt className="text-text-muted">LATEST</dt>
            <dd className="text-text">{country.latest_case_date ?? '—'}</dd>
          </dl>
        )}
        <section>
          <SectionHeader>CASES IN {countryCode}</SectionHeader>
          {list.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">No known cases linked to this country.</p>
          ) : (
            <ul className="mt-2 flex flex-col">
              {list.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`?case=${c.case_code}`}
                    replace
                    className="flex items-center justify-between border-b border-border-soft py-2 last:border-0 hover:bg-surface-2"
                  >
                    <span className="font-mono text-[11.5px] text-text">{c.case_code}</span>
                    <CaseStatusPill status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  return (
    <aside
      data-testid="dossier-drawer"
      className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-full max-w-[420px] transform overflow-y-auto border-l border-border-strong bg-surface-2 transition-transform duration-200 ${
        open ? 'pointer-events-auto translate-x-0' : 'translate-x-full'
      }`}
    >
      {open && (
        <button
          onClick={close}
          aria-label="Close drawer"
          className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center text-text-muted hover:text-text"
        >
          <X size={16} />
        </button>
      )}
      {body}
    </aside>
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
git add components/ops/DossierDrawer.tsx
git commit -m "$(cat <<'EOF'
Add DossierDrawer driven by ?case= / ?country= URL params

Slides in from the right edge of its containing positioned parent
(the Map tab area) when either ?case=<code> or ?country=<iso2> is
set. Case mode renders <CaseDossier> with sourceEvent resolved
from existing events array. Country mode renders country stats +
list of cases linked to that country (via current_country or
exposure_country); each case link uses ?case= to drill further.
Close button clears both params via router.replace.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Wire DashboardClient + extend `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/DashboardClient.tsx`

- [ ] **Step 1: Update `app/page.tsx` to fetch cases + case_locations**

Replace `/Users/claude/Projects/project_contagion/app/page.tsx`:

```tsx
import { createServerClient } from '@/lib/supabase-server';
import { DashboardClient } from './DashboardClient';
import type { Event, Snapshot, CountryStat, Case, CaseLocation } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = createServerClient();

  const [snapshotRes, snapshotHistoryRes, eventsRes, countriesRes, casesRes, locationsRes] =
    await Promise.all([
      supabase.from('snapshots').select('*').eq('disease', 'hantavirus')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('snapshots').select('*').eq('disease', 'hantavirus')
        .order('created_at', { ascending: true }).limit(30),
      supabase.from('events').select('*').eq('disease', 'hantavirus')
        .is('duplicate_of', null).order('created_at', { ascending: false }).limit(50),
      supabase.from('country_stats').select('*').eq('disease', 'hantavirus'),
      supabase.from('cases').select('*').eq('disease', 'hantavirus'),
      supabase.from('case_locations').select('*'),
    ]);

  return (
    <DashboardClient
      initialSnapshot={(snapshotRes.data as Snapshot | null) ?? null}
      initialSnapshotHistory={(snapshotHistoryRes.data as Snapshot[] | null) ?? []}
      initialEvents={(eventsRes.data as Event[] | null) ?? []}
      initialCountries={(countriesRes.data as CountryStat[] | null) ?? []}
      initialCases={(casesRes.data as Case[] | null) ?? []}
      initialCaseLocations={(locationsRes.data as CaseLocation[] | null) ?? []}
    />
  );
}
```

- [ ] **Step 2: Replace `app/DashboardClient.tsx`** with the Ops Console root

Replace `/Users/claude/Projects/project_contagion/app/DashboardClient.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Event, Snapshot, CountryStat, Case, CaseLocation } from '@/lib/types';
import { getBrowserClient } from '@/lib/supabase-browser';
import { TopBar } from '@/components/ops/TopBar';
import { SituationBrief } from '@/components/ops/SituationBrief';
import { KpiGrid } from '@/components/ops/KpiGrid';
import { PostureMatrix } from '@/components/ops/PostureMatrix';
import { Watchlist } from '@/components/ops/Watchlist';
import { TabStrip, type Tab } from '@/components/ops/TabStrip';
import { MapPane } from '@/components/ops/MapPane';
import { ByCountryPane } from '@/components/ops/ByCountryPane';
import { DossierDrawer } from '@/components/ops/DossierDrawer';

interface Props {
  initialSnapshot: Snapshot | null;
  initialSnapshotHistory: Snapshot[];
  initialEvents: Event[];
  initialCountries: CountryStat[];
  initialCases: Case[];
  initialCaseLocations: CaseLocation[];
}

export function DashboardClient({
  initialSnapshot,
  initialSnapshotHistory,
  initialEvents,
  initialCountries,
  initialCases,
  initialCaseLocations,
}: Props) {
  const searchParams = useSearchParams();
  const caseCode = searchParams.get('case');
  const countryCode = searchParams.get('country');

  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [snapshotHistory, setSnapshotHistory] = useState(initialSnapshotHistory);
  const [events, setEvents] = useState(initialEvents);
  const [countries, setCountries] = useState(initialCountries);
  const [cases, setCases] = useState(initialCases);
  const [caseLocations, setCaseLocations] = useState(initialCaseLocations);
  const [activeTab, setActiveTab] = useState<'map' | 'country'>('map');

  useEffect(() => { setSnapshot(initialSnapshot); }, [initialSnapshot]);
  useEffect(() => { setSnapshotHistory(initialSnapshotHistory); }, [initialSnapshotHistory]);
  useEffect(() => { setEvents(initialEvents); }, [initialEvents]);
  useEffect(() => { setCountries(initialCountries); }, [initialCountries]);
  useEffect(() => { setCases(initialCases); }, [initialCases]);
  useEffect(() => { setCaseLocations(initialCaseLocations); }, [initialCaseLocations]);

  useEffect(() => {
    const supabase = getBrowserClient();

    const ch1 = supabase.channel('events-rt')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events', filter: 'disease=eq.hantavirus' },
        (p) => {
          const ev = p.new as Event;
          if (ev.duplicate_of) return;
          setEvents((prev) => prev.find((e) => e.id === ev.id) ? prev : [ev, ...prev]);
        })
      .subscribe();

    const ch2 = supabase.channel('snapshots-rt')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'snapshots', filter: 'disease=eq.hantavirus' },
        (p) => {
          const s = p.new as Snapshot;
          setSnapshot(s);
          setSnapshotHistory((prev) => prev.find((x) => x.id === s.id) ? prev : [...prev, s].slice(-30));
        })
      .subscribe();

    const ch3 = supabase.channel('country-rt')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'country_stats', filter: 'disease=eq.hantavirus' },
        (p) => {
          const row = (p.new ?? p.old) as CountryStat;
          setCountries((prev) => {
            const next = prev.filter((r) => r.country_code !== row.country_code);
            if (p.eventType !== 'DELETE') next.push(row);
            return next;
          });
        })
      .subscribe();

    const ch4 = supabase.channel('cases-rt')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'cases', filter: 'disease=eq.hantavirus' },
        (p) => {
          const row = (p.new ?? p.old) as Case;
          setCases((prev) => {
            const next = prev.filter((c) => c.id !== row.id);
            if (p.eventType !== 'DELETE') next.push(row);
            return next;
          });
        })
      .subscribe();

    const ch5 = supabase.channel('case-loc-rt')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'case_locations' },
        (p) => {
          const row = p.new as CaseLocation;
          setCaseLocations((prev) => prev.find((l) => l.id === row.id) ? prev : [...prev, row]);
        })
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      supabase.removeChannel(ch3);
      supabase.removeChannel(ch4);
      supabase.removeChannel(ch5);
    };
  }, []);

  const prevSnapshot = snapshotHistory.length >= 2 ? snapshotHistory[snapshotHistory.length - 2] : null;
  const selectedCaseId = caseCode ? cases.find((c) => c.case_code === caseCode)?.id ?? null : null;

  const tabs: Tab[] = [
    { id: 'map', label: 'MAP', count: cases.length },
    { id: 'country', label: 'BY COUNTRY', count: countries.length },
  ];

  return (
    <div className="flex h-screen flex-col">
      <TopBar snapshot={snapshot} />
      <div className="grid flex-1 overflow-hidden lg:grid-cols-2">
        {/* Sit-rep (left) */}
        <div className="overflow-y-auto border-b border-border lg:border-b-0 lg:border-r">
          <SituationBrief snapshot={snapshot} />
          <KpiGrid snapshot={snapshot} prevSnapshot={prevSnapshot} />
          <PostureMatrix countries={countries} />
          <Watchlist events={events} />
        </div>

        {/* Workspace (right) */}
        <div className="relative flex flex-col overflow-hidden">
          <TabStrip tabs={tabs} active={activeTab} onChange={(id) => setActiveTab(id as 'map' | 'country')} />
          <div className="relative flex-1">
            {activeTab === 'map' && (
              <>
                <MapPane
                  countries={countries}
                  cases={cases}
                  caseLocations={caseLocations}
                  selectedCaseId={selectedCaseId}
                />
                <DossierDrawer
                  cases={cases}
                  caseLocations={caseLocations}
                  countries={countries}
                  events={events}
                  caseCode={caseCode}
                  countryCode={countryCode}
                />
              </>
            )}
            {activeTab === 'country' && <ByCountryPane rows={countries} />}
          </div>
        </div>
      </div>
    </div>
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
./scripts/reset-db.sh > /dev/null 2>&1
(lsof -ti :3000 | xargs kill -9 2>/dev/null || true)
rm -rf .next
(npm run dev > /tmp/next-dev.log 2>&1 &) && sleep 12
curl -s http://localhost:3000 | grep -oE 'PATHWATCH|SITUATION BRIEF|KEY METRICS|REGIONAL POSTURE|WATCHLIST|MAP' | sort -u
pkill -f "next dev" 2>/dev/null; sleep 1; true
```

Expected: prints `KEY METRICS`, `MAP`, `PATHWATCH`, `REGIONAL POSTURE`, `SITUATION BRIEF`, `WATCHLIST`.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/DashboardClient.tsx
git commit -m "$(cat <<'EOF'
Wire DashboardClient as Ops Console root

app/page.tsx parallel-fetch grows to 6 queries (adds cases +
case_locations). DashboardClient is rewritten: TopBar at top,
50/50 sit-rep | workspace grid below. Sit-rep = SituationBrief +
KpiGrid + PostureMatrix + Watchlist. Workspace = TabStrip with
Map and ByCountry tabs; the Map tab area positions DossierDrawer
absolutely so the slide-in lives within the workspace bounds.
Realtime subscribes to all 5 tables; URL ?case=/?country= drives
drawer state via useSearchParams.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: `/case/[case_code]` permalink page + drop old files + smoke rewrite

**Files:**
- Create: `app/case/[case_code]/page.tsx`
- Create: `app/case/[case_code]/not-found.tsx`
- Modify: `tests/dashboard.spec.ts`
- Delete: `components/overview/SituationOverview.tsx`, `components/overview/StatCard.tsx`, `components/overview/RiskBadge.tsx`, `components/feed/EventCard.tsx`, `components/feed/EventFeed.tsx`, `components/feed/FilterBar.tsx`, `components/charts/TrendChart.tsx`, `components/charts/SourceActivityChart.tsx`, `components/country/CountryBreakdown.tsx`, `components/layout/Header.tsx`, `components/layout/Footer.tsx`

- [ ] **Step 1: Write `app/case/[case_code]/not-found.tsx`**

Create `/Users/claude/Projects/project_contagion/app/case/[case_code]/not-found.tsx`:

```tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-[760px] px-6 py-16 text-center">
      <h1 className="mb-2 font-mono text-2xl font-bold uppercase tracking-[0.05em] text-text">CASE NOT FOUND</h1>
      <p className="mb-6 text-sm text-text-secondary">
        That case code doesn&apos;t correspond to any record.
      </p>
      <Link href="/" className="font-mono text-xs uppercase tracking-[0.1em] text-accent hover:underline">
        ← BACK TO DASHBOARD
      </Link>
    </main>
  );
}
```

- [ ] **Step 2: Write `app/case/[case_code]/page.tsx`**

Create `/Users/claude/Projects/project_contagion/app/case/[case_code]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase-server';
import { CaseDossier } from '@/components/case/CaseDossier';
import type { Case, CaseLocation, Event } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function fetchCase(case_code: string): Promise<{
  case_: Case | null;
  locations: CaseLocation[];
  sourceEvent: Event | null;
}> {
  const supabase = createServerClient();
  const { data: case_ } = await supabase
    .from('cases')
    .select('*')
    .eq('case_code', case_code)
    .maybeSingle();
  if (!case_) return { case_: null, locations: [], sourceEvent: null };

  const [locRes, eventRes] = await Promise.all([
    supabase.from('case_locations').select('*').eq('case_id', case_.id),
    case_.source_event_id
      ? supabase.from('events').select('*').eq('id', case_.source_event_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    case_: case_ as Case,
    locations: (locRes.data as CaseLocation[] | null) ?? [],
    sourceEvent: (eventRes.data as Event | null) ?? null,
  };
}

export async function generateMetadata({
  params,
}: {
  params: { case_code: string };
}): Promise<Metadata> {
  const { case_ } = await fetchCase(params.case_code);
  if (!case_) return { title: 'Case not found — Pathwatch' };
  return {
    title: `${case_.case_code} — Pathwatch`,
    description: case_.dossier?.slice(0, 200) ?? `Case dossier for ${case_.case_code}`,
  };
}

export default async function CasePage({ params }: { params: { case_code: string } }) {
  const { case_, locations, sourceEvent } = await fetchCase(params.case_code);
  if (!case_) notFound();
  return (
    <main className="mx-auto max-w-[840px] px-6 py-8">
      <Link
        href="/"
        className="mb-6 inline-block font-mono text-xs uppercase tracking-[0.1em] text-accent hover:underline"
      >
        ← BACK TO DASHBOARD
      </Link>
      <CaseDossier case_={case_} locations={locations} sourceEvent={sourceEvent} />
    </main>
  );
}
```

- [ ] **Step 3: Drop the dead 2a/2b components**

```bash
rm -f \
  components/overview/SituationOverview.tsx \
  components/overview/StatCard.tsx \
  components/overview/RiskBadge.tsx \
  components/feed/EventCard.tsx \
  components/feed/EventFeed.tsx \
  components/feed/FilterBar.tsx \
  components/charts/TrendChart.tsx \
  components/charts/SourceActivityChart.tsx \
  components/country/CountryBreakdown.tsx \
  components/layout/Header.tsx \
  components/layout/Footer.tsx
rmdir components/overview components/charts components/country components/layout 2>/dev/null || true
```

`components/feed/SourceIcon.tsx` stays — `EventDetail.tsx` and `EventTooltip.tsx` (kept) still import it. Verify with `grep -r "SourceIcon" components app | grep -v feed/SourceIcon` — should print 2 matches (EventDetail, EventTooltip). If 0 matches, delete `components/feed/SourceIcon.tsx` and the empty `components/feed/` directory.

- [ ] **Step 4: Confirm no leftover imports**

```bash
grep -r "from '@/components/overview" app components 2>/dev/null
grep -r "from '@/components/feed/EventCard" app components 2>/dev/null
grep -r "from '@/components/feed/EventFeed" app components 2>/dev/null
grep -r "from '@/components/feed/FilterBar" app components 2>/dev/null
grep -r "from '@/components/charts" app components 2>/dev/null
grep -r "from '@/components/country" app components 2>/dev/null
grep -r "from '@/components/layout/Header" app components 2>/dev/null
grep -r "from '@/components/layout/Footer" app components 2>/dev/null
```

Expected: no output. If any matches, fix or finish removing whatever still uses the dead component.

- [ ] **Step 5: Replace `tests/dashboard.spec.ts`**

Replace `/Users/claude/Projects/project_contagion/tests/dashboard.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('ops console renders sit-rep + tabs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('PATHWATCH').first()).toBeVisible();
  await expect(page.getByText('OPS CONSOLE')).toBeVisible();
  await expect(page.getByText('SITUATION BRIEF')).toBeVisible();
  await expect(page.getByText('KEY METRICS')).toBeVisible();
  await expect(page.getByText('REGIONAL POSTURE')).toBeVisible();
  await expect(page.getByText('WATCHLIST')).toBeVisible();
  await expect(page.getByTestId('kpi-cases')).toContainText('8');
  await expect(page.getByRole('tab', { name: /MAP/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /BY COUNTRY/ })).toBeVisible();
});

test('case drilldown opens drawer', async ({ page }) => {
  await page.goto('/?case=MVH-001');
  await expect(page.getByTestId('dossier-drawer')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'MVH-001' })).toBeVisible();
  await expect(page.getByText('DOSSIER')).toBeVisible();
  await expect(page.getByText(/birdwatching/i)).toBeVisible();
  await expect(page.getByText('TRAVEL TIMELINE')).toBeVisible();
});

test('case permalink page', async ({ page }) => {
  await page.goto('/case/MVH-001');
  await expect(page.getByRole('heading', { name: 'MVH-001' })).toBeVisible();
  await expect(page.getByText(/Dutch retiree/i)).toBeVisible();
  await expect(page.getByText('← BACK TO DASHBOARD')).toBeVisible();
});

test('event detail page renders', async ({ page }) => {
  await page.goto('/');
  // Click the first watchlist item that has MV Hondius in title
  const link = page.getByRole('link').filter({ hasText: /MV Hondius/i }).first();
  await link.click();
  await expect(page).toHaveURL(/\/event\/[0-9a-f-]+/);
  await expect(page.getByRole('heading', { level: 1, name: /MV Hondius/i })).toBeVisible();
});

test('OG image generates', async ({ request }) => {
  const res = await request.get('/opengraph-image');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/png');
});
```

- [ ] **Step 6: Run the full smoke**

```bash
npm run test:smoke 2>&1 | tail -10
```

Expected: `5 passed`.

- [ ] **Step 7: Final verification**

```bash
npm run lint
npm run typecheck
npm run build
```

Expected: all three exit 0. Build output should now include `/` (dynamic), `/case/[case_code]` (dynamic), `/event/[id]` (dynamic), `/about` (static), `/opengraph-image` (dynamic), `/event/[id]/opengraph-image` (dynamic).

- [ ] **Step 8: Commit**

```bash
git add app/case tests/dashboard.spec.ts
git rm -rf components/overview components/charts components/country components/layout components/feed/EventCard.tsx components/feed/EventFeed.tsx components/feed/FilterBar.tsx 2>/dev/null || true
git commit -m "$(cat <<'EOF'
Add /case/[case_code] permalink + drop dead 2a/2b components + new smoke

/case/[case_code] page is a thin wrapper around CaseDossier. Returns
notFound when the case_code doesn't exist. generateMetadata sets
title + dossier excerpt for the page head and OG fallback.

Drops every component the Ops Console rewrite no longer uses:
SituationOverview, StatCard, RiskBadge, EventCard, EventFeed,
FilterBar, TrendChart, SourceActivityChart, CountryBreakdown,
Header, Footer.

Smoke spec rewritten: 5 tests covering ops sit-rep + tabs, case
drilldown drawer, case permalink page, event detail navigation
(via watchlist), and OG image content-type.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verification (full plan complete)

After Task 11:
- `/` renders the Ops Console: top bar, sit-rep with situation brief / KPI grid / posture matrix / watchlist, tab strip with Map + By Country, MapLibre choropleth + status-colored case markers.
- Click case marker → URL becomes `?case=MVH-001`, drawer slides in with dossier + travel timeline, map shows the dashed travel-path layer.
- Click country polygon → URL becomes `?country=AR`, drawer shows country stats + cases-in-country list. Click a case in the list → drills into dossier mode.
- `/case/MVH-001` is a standalone permalink page that renders the same `CaseDossier` component.
- `/event/[id]` route still works; OG image still works.
- `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:smoke` all pass.

## Out of scope (next sub-projects)

- Sub-project 3: facts schema + /facts page + pipeline runbook
- Mutations / Field cams / Wastewater tabs (deferred until backing data exists)
- Tone toggle UI (cool / warm / neutral) — CSS variables defined, no toggle exposed
- Trend chart / Source activity chart re-introduction
- Mobile bottom-sheet drawer (acceptable to be desktop-primary for v1)
- Custom domain + Vercel auto-deploy (still deferred from sub-project 2c)
