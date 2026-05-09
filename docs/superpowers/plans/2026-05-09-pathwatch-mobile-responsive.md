# Pathwatch Mobile-Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Pathwatch usable and polished on mobile portrait — collapsible map, drag-to-resize bottom sheet for the dossier, condensed top strips, single-column stack below `lg`.

**Architecture:** Tailwind responsive classes with one breakpoint at `lg` (1024px). Below `lg`, a new `<MobileLayout>` renders a single-column stack with mobile-only components (`MapWithToggle`, `CaseDossierSheet`, `PostureMatrixCards`). At `lg+`, the existing desktop grid renders unchanged. Both consume the same data and state — no JavaScript media queries, no hydration flicker.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind v3, [Vaul](https://vaul.emilkowal.ski/) (bottom sheet), MapLibre GL, deck.gl, Playwright (smoke).

---

### Task 0: Install vaul + smoke baseline

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Install vaul**

```bash
npm install vaul
```

- [ ] **Step 2: Run baseline smoke**

```bash
npm run test:smoke
```

Expected: `10 passed`.

- [ ] **Step 3: Commit dependency**

```bash
git add package.json package-lock.json
git commit -m "Add vaul for bottom-sheet primitive"
```

---

### Task 1: TopBar minimal on mobile

Hide UTC, SCOPE, RISK, and OPS CONSOLE chips below `lg` so the bar fits a phone width.

**Files:**
- Modify: `components/ops/TopBar.tsx`

- [ ] **Step 1: Replace TopBar with the responsive version**

```tsx
// components/ops/TopBar.tsx
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
      <span className="hidden text-text-muted lg:inline">OPS CONSOLE</span>
      <span className="flex items-center gap-1.5 text-green">
        <span className="dot-pulse inline-block h-1.5 w-1.5 rounded-full bg-green" />
        LIVE
      </span>
      <span className="ml-auto hidden items-center gap-4 text-text-secondary lg:flex">
        <span>SCOPE GLOBAL</span>
        <span className="border-l border-border pl-4">UTC {utcStamp()}</span>
        <span className={`border-l border-border pl-4 ${riskClass.split(' ')[0]}`}>{riskLabel}</span>
      </span>
    </header>
  );
}
```

- [ ] **Step 2: typecheck + lint**

```bash
npx tsc --noEmit
node_modules/.bin/eslint components/ops/TopBar.tsx
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/ops/TopBar.tsx
git commit -m "TopBar: hide UTC/SCOPE/RISK/OPS CONSOLE below lg"
```

---

### Task 2: ThreatBanner condensed on mobile

Tighten gaps and label sizes below `lg`.

**Files:**
- Modify: `components/threat/ThreatBanner.tsx`
- Modify: `components/threat/ProbabilityMeter.tsx`

- [ ] **Step 1: Update ThreatBanner gap spacing**

In `components/threat/ThreatBanner.tsx`, change the button class:

```tsx
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2 lg:gap-6 lg:px-4"
```

(Was: `gap-6 px-4 py-2`.)

- [ ] **Step 2: Update ProbabilityMeter to hide the long "PANDEMIC PROBABILITY" label below lg**

In `components/threat/ProbabilityMeter.tsx`, change the trailing label span to:

```tsx
      <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted lg:inline">
        PANDEMIC PROBABILITY
      </span>
```

Also reduce the percentage size below lg by changing the value span:

```tsx
      <span className="font-mono text-[16px] font-semibold leading-none text-text lg:text-[20px]">
        {pct}%
      </span>
```

- [ ] **Step 3: typecheck + lint**

```bash
npx tsc --noEmit
node_modules/.bin/eslint components/threat/
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/threat/ThreatBanner.tsx components/threat/ProbabilityMeter.tsx
git commit -m "ThreatBanner: tighter spacing + smaller value below lg"
```

---

### Task 3: Trace popup viewport-safe

Cap the trace stop popup at `min(360px, 92vw)` so it never exceeds a phone's screen width.

**Files:**
- Modify: `components/map/MapPanel.tsx`

- [ ] **Step 1: Update the Popup maxWidth**

Find the `new maplibregl.Popup({` block (around line 256) and change `maxWidth` from `'360px'` to:

```tsx
          maxWidth: 'min(360px, 92vw)',
```

- [ ] **Step 2: typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/map/MapPanel.tsx
git commit -m "Cap trace popup width at 92vw so it fits phone screens"
```

---

### Task 4: PostureMatrixCards (mobile-only vertical card list)

Replace the table render with a vertical list below `lg`.

**Files:**
- Create: `components/ops/PostureMatrixCards.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/ops/PostureMatrixCards.tsx
import type { CountryStat } from '@/lib/types';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { formatNumber } from '@/lib/format';

const STATUS_TAG: Record<NonNullable<CountryStat['status']>, string> = {
  active: 'border-red text-red',
  contained: 'border-amber text-amber',
  monitoring: 'border-green text-green',
  clear: 'border-text-muted text-text-muted',
};

export function PostureMatrixCards({ countries }: { countries: CountryStat[] }) {
  const sorted = [...countries].sort((a, b) => b.cases - a.cases);
  return (
    <ul className="mt-3 divide-y divide-border-soft border-y border-border-soft">
      {sorted.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-3 px-1 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <CountryFlag code={c.country_code} />
            <span className="truncate font-mono text-[12px] text-text">{c.country_name}</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
            <span className="text-text-muted">CASES <span className="text-text">{formatNumber(c.cases)}</span></span>
            <span className="text-text-muted">DEATHS <span className="text-text">{formatNumber(c.deaths)}</span></span>
            <span className={`border px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.1em] ${c.status ? STATUS_TAG[c.status] : 'border-border text-text-muted'}`}>
              {c.status ?? '—'}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Wire into PostureMatrix to switch at lg**

Replace the body of `components/ops/PostureMatrix.tsx` `return` block (the section after the empty-state check) with:

```tsx
  return (
    <section className="border-b border-border px-4 py-4">
      <SectionHeader>COUNTRIES AFFECTED</SectionHeader>

      {/* Mobile: card list */}
      <div className="lg:hidden">
        <PostureMatrixCards countries={countries} />
      </div>

      {/* Desktop: table */}
      <table className="mt-3 hidden w-full font-mono text-[11.5px] lg:table">
        <thead className="text-text-muted">
          <tr className="border-b border-border-soft">
            <th className="px-2 py-1 text-left font-medium">COUNTRY</th>
            <th className="px-2 py-1 text-right font-medium">CASES</th>
            <th className="px-2 py-1 text-right font-medium">DEATHS</th>
            <th className="px-2 py-1 text-left font-medium">STATUS</th>
          </tr>
        </thead>
        <tbody>
          {[...countries].sort((a, b) => b.cases - a.cases).map((c) => (
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
```

Also add the import:

```tsx
import { PostureMatrixCards } from './PostureMatrixCards';
```

- [ ] **Step 3: typecheck + lint**

```bash
npx tsc --noEmit
node_modules/.bin/eslint components/ops/
```

- [ ] **Step 4: Commit**

```bash
git add components/ops/PostureMatrix.tsx components/ops/PostureMatrixCards.tsx
git commit -m "PostureMatrix: vertical card list below lg, table at lg+"
```

---

### Task 5: MapWithToggle (mobile-only collapsible map wrapper)

Renders the map with a `Hide Map / Show Map` button. Persists open state to localStorage.

**Files:**
- Create: `components/ops/MapWithToggle.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/ops/MapWithToggle.tsx
'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Case, CaseLocation, CountryStat } from '@/lib/types';
import { MapPanel } from '@/components/map/MapPanel';

const KEY = 'pathwatch:mobile-map-open';

interface Props {
  countries: CountryStat[];
  cases: Case[];
  caseLocations: CaseLocation[];
  selectedCaseId: string | null;
}

export function MapWithToggle({ countries, cases, caseLocations, selectedCaseId }: Props) {
  const [open, setOpen] = useState<boolean>(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY);
    if (stored === 'closed') setOpen(false);
    setHydrated(true);
  }, []);

  function toggle() {
    setOpen((v) => {
      const next = !v;
      try { window.localStorage.setItem(KEY, next ? 'open' : 'closed'); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <section className="border-b border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border-soft px-4 py-2">
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-green hover:text-text"
          aria-expanded={open}
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {open ? 'Hide Map' : 'Show Map'}
        </button>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
          {cases.length} CASES · {countries.length} COUNTRIES
        </span>
      </div>
      {hydrated && open && (
        <div className="relative h-[55vh]">
          <MapPanel
            countries={countries}
            cases={cases}
            caseLocations={caseLocations}
            selectedCaseId={selectedCaseId}
          />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: typecheck + lint**

```bash
npx tsc --noEmit
node_modules/.bin/eslint components/ops/MapWithToggle.tsx
```

- [ ] **Step 3: Commit**

```bash
git add components/ops/MapWithToggle.tsx
git commit -m "Add MapWithToggle: collapsible map with localStorage persistence"
```

---

### Task 6: CaseDossierSheet (Vaul bottom sheet)

Wraps the existing `<CaseDossier>` inside a Vaul drawer with three snap points. Visibility driven by the `?case=` URL param.

**Files:**
- Create: `components/case/CaseDossierSheet.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/case/CaseDossierSheet.tsx
'use client';
import { Drawer } from 'vaul';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import type { Case, CaseLocation, Event } from '@/lib/types';
import { CaseDossier } from './CaseDossier';

interface Props {
  cases: Case[];
  caseLocations: CaseLocation[];
  events: Event[];
  caseCode: string | null;
}

export function CaseDossierSheet({ cases, caseLocations, events, caseCode }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const open = caseCode != null;
  const c = caseCode ? cases.find((x) => x.case_code === caseCode) ?? null : null;
  const sourceEvent = c?.source_event_id ? events.find((e) => e.id === c.source_event_id) ?? null : null;

  function close() {
    const u = new URLSearchParams(searchParams.toString());
    u.delete('case');
    const qs = u.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => { if (!o) close(); }}
      snapPoints={[0.3, 0.55, 0.85]}
      activeSnapPoint={open ? 0.55 : null}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Drawer.Content
          data-testid="dossier-sheet"
          className="fixed inset-x-0 bottom-0 z-50 flex h-[90vh] flex-col rounded-t-[8px] border-t border-border-strong bg-surface-2 outline-none"
        >
          <Drawer.Title className="sr-only">Case dossier</Drawer.Title>
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
          <div className="flex items-center justify-between px-4 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">DOSSIER</span>
            <button
              type="button"
              onClick={close}
              aria-label="Close dossier"
              className="inline-flex h-6 w-6 items-center justify-center rounded text-text-muted hover:text-text"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {c ? (
              <CaseDossier case_={c} locations={caseLocations} sourceEvent={sourceEvent} showOpenLink />
            ) : (
              <p className="px-4 py-6 text-center text-sm text-text-muted">Case not found.</p>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
```

- [ ] **Step 2: typecheck + lint**

```bash
npx tsc --noEmit
node_modules/.bin/eslint components/case/CaseDossierSheet.tsx
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/case/CaseDossierSheet.tsx
git commit -m "Add CaseDossierSheet: Vaul drag-to-resize bottom sheet for the dossier"
```

---

### Task 7: MobileLayout (single-column stacked layout)

Assemble the mobile-only layout. Renders the section order from the spec.

**Files:**
- Create: `components/ops/MobileLayout.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/ops/MobileLayout.tsx
'use client';
import type {
  Event, Snapshot, CountryStat, Case, CaseLocation, ThreatAssessment, Fact,
} from '@/lib/types';
import { SituationBrief } from './SituationBrief';
import { KpiGrid } from './KpiGrid';
import { PostureMatrix } from './PostureMatrix';
import { Watchlist } from './Watchlist';
import { MonitoringCohort } from './MonitoringCohort';
import { MapWithToggle } from './MapWithToggle';
import { VirusProfile } from '@/components/profile/VirusProfile';
import { EventFeed } from '@/components/feed/EventFeed';
import { ThreatBanner } from '@/components/threat/ThreatBanner';
import { CaseDossierSheet } from '@/components/case/CaseDossierSheet';

interface Props {
  snapshot: Snapshot | null;
  prevSnapshot: Snapshot | null;
  events: Event[];
  countries: CountryStat[];
  cases: Case[];
  caseLocations: CaseLocation[];
  threat: ThreatAssessment | null;
  facts: Fact[];
  monitoringCases: Case[];
  selectedCaseId: string | null;
  caseCode: string | null;
}

export function MobileLayout({
  snapshot,
  prevSnapshot,
  events,
  countries,
  cases,
  caseLocations,
  threat,
  facts,
  monitoringCases,
  selectedCaseId,
  caseCode,
}: Props) {
  return (
    <div data-testid="mobile-layout" className="flex flex-col">
      {threat && <ThreatBanner assessment={threat} />}
      <MapWithToggle
        countries={countries}
        cases={cases}
        caseLocations={caseLocations}
        selectedCaseId={selectedCaseId}
      />
      <SituationBrief snapshot={snapshot} />
      <KpiGrid snapshot={snapshot} prevSnapshot={prevSnapshot} />
      <PostureMatrix countries={countries} />
      <Watchlist events={events} />
      <MonitoringCohort cases={monitoringCases} />
      <VirusProfile facts={facts} />
      <EventFeed events={events} />
      <CaseDossierSheet
        cases={cases}
        caseLocations={caseLocations}
        events={events}
        caseCode={caseCode}
      />
    </div>
  );
}
```

- [ ] **Step 2: typecheck + lint**

```bash
npx tsc --noEmit
node_modules/.bin/eslint components/ops/MobileLayout.tsx
```

- [ ] **Step 3: Commit**

```bash
git add components/ops/MobileLayout.tsx
git commit -m "Add MobileLayout: single-column stacked layout for below lg"
```

---

### Task 8: Wire MobileLayout into DashboardClient

Branch the layout — render the desktop grid only at `lg+`, render `<MobileLayout>` only below `lg`. The threat banner moves out of the shared header so each layout owns its own top stack.

**Files:**
- Modify: `app/DashboardClient.tsx`

- [ ] **Step 1: Locate the JSX return block**

Read `app/DashboardClient.tsx` and find the `return ( ... )` block at the end of `DashboardClient`. It currently looks like:

```tsx
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar snapshot={snapshot} />
      {threat && <ThreatBanner assessment={threat} />}
      <div className="grid h-[calc(100vh-2rem)] lg:grid-cols-[35fr_65fr]">
        {/* Sit-rep (left, ~35%) */}
        <div className="overflow-y-auto border-b border-border lg:border-b-0 lg:border-r">
          <SituationBrief snapshot={snapshot} />
          <KpiGrid snapshot={snapshot} prevSnapshot={prevSnapshot} />
          <PostureMatrix countries={countries} />
          <Watchlist events={events} />
          <MonitoringCohort cases={monitoringCases} />
          <VirusProfile facts={facts} />
        </div>

        {/* Workspace (right, ~65%) */}
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

      {/* Full-width intelligence feed below the grid */}
      <EventFeed events={events} />
    </div>
  );
```

- [ ] **Step 2: Replace it with the branched version**

Add `import { MobileLayout } from '@/components/ops/MobileLayout';` at the top, then change the return block to:

```tsx
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar snapshot={snapshot} />

      {/* Mobile: single-column stack with collapsible map + bottom sheet */}
      <div className="lg:hidden">
        <MobileLayout
          snapshot={snapshot}
          prevSnapshot={prevSnapshot}
          events={events}
          countries={countries}
          cases={cases}
          caseLocations={caseLocations}
          threat={threat}
          facts={facts}
          monitoringCases={monitoringCases}
          selectedCaseId={selectedCaseId}
          caseCode={caseCode}
        />
      </div>

      {/* Desktop: 35/65 grid + full-width feed */}
      <div className="hidden lg:contents">
        {threat && <ThreatBanner assessment={threat} />}
        <div className="grid h-[calc(100vh-2rem)] lg:grid-cols-[35fr_65fr]">
          {/* Sit-rep (left) */}
          <div className="overflow-y-auto border-b border-border lg:border-b-0 lg:border-r">
            <SituationBrief snapshot={snapshot} />
            <KpiGrid snapshot={snapshot} prevSnapshot={prevSnapshot} />
            <PostureMatrix countries={countries} />
            <Watchlist events={events} />
            <MonitoringCohort cases={monitoringCases} />
            <VirusProfile facts={facts} />
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
        <EventFeed events={events} />
      </div>
    </div>
  );
```

- [ ] **Step 3: typecheck + lint**

```bash
npx tsc --noEmit
node_modules/.bin/eslint app/DashboardClient.tsx
```

Expected: clean.

- [ ] **Step 4: Run desktop smoke specs to confirm no regression**

```bash
npm run test:smoke
```

Expected: 10 passed.

- [ ] **Step 5: Commit**

```bash
git add app/DashboardClient.tsx
git commit -m "DashboardClient: branch layout at lg — mobile stack vs desktop grid"
```

---

### Task 9: Mobile smoke specs

New tests at viewport 390×844 in `tests/mobile.spec.ts`.

**Files:**
- Create: `tests/mobile.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// tests/mobile.spec.ts
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('mobile: stacks single-column with mobile layout', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('mobile-layout')).toBeVisible();
});

test('mobile: TopBar shows only brand + LIVE', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('PATHWATCH').first()).toBeVisible();
  await expect(page.getByText('LIVE', { exact: true })).toBeVisible();
  await expect(page.getByText(/^OPS CONSOLE$/)).toHaveCount(0);
  await expect(page.getByText(/^SCOPE GLOBAL$/)).toHaveCount(0);
  await expect(page.getByText(/^UTC \d{4}-/)).toHaveCount(0);
  await expect(page.getByText(/^RISK /)).toHaveCount(0);
});

test('mobile: map collapse toggle hides + shows map', async ({ page }) => {
  await page.goto('/');
  // Default: open. Click Hide Map.
  const toggle = page.getByRole('button', { name: /Hide Map/ });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.getByRole('button', { name: /Show Map/ })).toBeVisible();
  // Re-open.
  await page.getByRole('button', { name: /Show Map/ }).click();
  await expect(page.getByRole('button', { name: /Hide Map/ })).toBeVisible();
});

test('mobile: case selection opens bottom sheet, close dismisses', async ({ page }) => {
  await page.goto('/?case=MVH-001');
  const sheet = page.getByTestId('dossier-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'MVH-001' })).toBeVisible();
  // Close via X
  await sheet.getByRole('button', { name: 'Close dossier' }).click();
  await expect(page).toHaveURL(/^http:\/\/[^/]+\/$/);
  await expect(sheet).toBeHidden();
});

test('mobile: country posture renders as cards (not table)', async ({ page }) => {
  await page.goto('/');
  await page.getByText('COUNTRIES AFFECTED').scrollIntoViewIfNeeded();
  // Section is visible
  await expect(page.getByText('COUNTRIES AFFECTED')).toBeVisible();
  // Card list shows CASES n / DEATHS n
  await expect(page.getByText(/CASES \d+/).first()).toBeVisible();
});
```

- [ ] **Step 2: Run mobile specs**

```bash
node_modules/.bin/playwright test tests/mobile.spec.ts
```

Expected: 5 passed.

- [ ] **Step 3: Run the full smoke suite (10 desktop + 5 mobile)**

```bash
npm run test:smoke
```

Expected: 15 passed.

- [ ] **Step 4: Commit**

```bash
git add tests/mobile.spec.ts
git commit -m "Smoke: 5 mobile specs at 390x844 viewport"
```

---

### Task 10: Push branch + verify Vercel preview

**Files:** none

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/mobile-responsive
```

- [ ] **Step 2: Watch for the preview deployment**

```bash
sleep 20
vercel ls 2>&1 | grep -E "feat-mobile-responsive|Preview" | head -5
```

The preview URL appears after Vercel finishes building. It looks like `pathwatch-<sha>-johns-projects-<id>.vercel.app`.

- [ ] **Step 3: Wait until READY**

```bash
PREVIEW_URL=$(vercel ls 2>&1 | grep "Preview" | head -1 | awk '{print $4}')
until vercel inspect "$PREVIEW_URL" 2>&1 | grep -qE 'status\s+(Ready|Error)'; do sleep 8; done
vercel inspect "$PREVIEW_URL" 2>&1 | grep -E "^\s*(status|url)" | head -3
```

Expected: `status Ready`.

- [ ] **Step 4: Spot-check the preview at mobile viewport**

```bash
curl -s -A "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" "$PREVIEW_URL" -o /tmp/preview.html
echo "PATHWATCH wordmark: $(grep -c 'PATHWATCH' /tmp/preview.html)"
echo "Hide Map: $(grep -c 'Hide Map' /tmp/preview.html)"
echo "Mobile layout: $(grep -c 'data-testid="mobile-layout"' /tmp/preview.html)"
```

Expected: each grep returns ≥ 1.

- [ ] **Step 5: Surface the preview URL**

Print the preview URL so the user can open it on their phone:

```bash
echo "Preview URL: $PREVIEW_URL"
```

User opens this URL on their phone to verify the look and feel. Production at `pathwatch-phi.vercel.app` is untouched.

- [ ] **Step 6: Commit nothing — this is verification only.**

If user requests iteration, return to Tasks 1-9 and amend; each push regenerates the preview.

If user approves: continue to merge step.

---

### Task 11: Merge to main + production deploy

Only run this step after the user has previewed the branch on their phone and approved.

**Files:** none

- [ ] **Step 1: Verify approval**

Confirm the user has explicitly said "merge it" or equivalent. If not, stop here.

- [ ] **Step 2: Merge + push**

```bash
git checkout main
git pull
git merge --no-ff feat/mobile-responsive -m "Merge feat/mobile-responsive: mobile-first dashboard with bottom sheet"
git push origin main
```

- [ ] **Step 3: Wait for production deploy**

```bash
sleep 20
PROD_URL=$(vercel ls 2>&1 | grep "Production" | head -1 | awk '{print $4}')
until vercel inspect "$PROD_URL" 2>&1 | grep -qE 'status\s+(Ready|Error)'; do sleep 8; done
echo "Prod: $PROD_URL"
```

- [ ] **Step 4: Cleanup branch**

```bash
git branch -d feat/mobile-responsive
git push origin --delete feat/mobile-responsive
```

---

## Self-review

**Spec coverage:**
- ✅ TopBar minimal on mobile → Task 1
- ✅ ThreatBanner condensed → Task 2
- ✅ Trace popup viewport-safe → Task 3
- ✅ PostureMatrixCards → Task 4
- ✅ MapWithToggle (collapsible map, localStorage) → Task 5
- ✅ CaseDossierSheet (Vaul, snap points 0.3/0.55/0.85) → Task 6
- ✅ MobileLayout assembly with section order from spec → Task 7
- ✅ DashboardClient branching at lg → Task 8
- ✅ 5 mobile smoke specs in tests/mobile.spec.ts → Task 9
- ✅ Vercel preview URL → Task 10
- ✅ Merge gated on user approval → Task 11

**Placeholder scan:** None. Every step has concrete code or commands.

**Type consistency:** `caseCode: string | null` in MobileLayout matches `caseCode` in DashboardClient. `selectedCaseId` is the resolved case id (UUID), `caseCode` is the URL slug — both flow through. CaseDossierSheet props (cases, caseLocations, events, caseCode) match what MobileLayout passes. PostureMatrixCards Props.countries matches what PostureMatrix passes.

**Out of scope (per spec):** touch gestures on map traces, offline mode, push notifications, marker tap-target enlargement, reduced-motion overrides — none of these have tasks, which is correct.
