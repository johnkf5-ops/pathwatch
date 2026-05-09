# Case Class Enum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disambiguate `cases` rows by adding a `case_class` enum (`confirmed_case | probable_case | suspected_case | contact | returnee`) so dashboard counts stop conflating cases with contacts.

**Architecture:** Additive `case_class` column on `cases`, populated via backfill migration for production and explicit values in `seed.sql` for local. UI components derive CASES and CONTACTS counts client-side from the cases array, replacing today's `cases.length` (which mixes contacts with cases). `country_stats.cases` is recounted to mean "cases (non-contact) currently in this country," and `snapshots.total_contacts` is added so the pipeline can write both numbers separately. Five sequential migrations land non-breaking → UI reads class → NOT NULL hardening last.

**Tech Stack:** Next.js 14 App Router (TypeScript), Supabase Postgres + RLS, Playwright smoke tests, Tailwind. Migrations live in `supabase/migrations/`. Local DB reset via `npm run db:reset` (Colima/Docker required). Smoke via `npm run test:smoke`.

**Spec:** `docs/superpowers/specs/2026-05-09-case-class-enum-design.md`. The spec's resolved decisions (§8) drive the choices below: `current_country` for country recount, suspected counts toward CASES, all class × status combinations allowed except `contact|returnee × deceased|critical`.

---

## File Structure

**New files:**
- `supabase/migrations/20260509170000_cases_class_enum.sql` — adds nullable `case_class TEXT` with CHECK constraint + two indexes.
- `supabase/migrations/20260509170100_cases_class_backfill.sql` — populates `case_class` for pre-existing prod rows (no-op on local since seed sets values explicitly).
- `supabase/migrations/20260509170200_country_stats_recount.sql` — recounts `country_stats.cases` from `cases` filtered by class, keyed on `current_country`.
- `supabase/migrations/20260509170300_snapshots_total_contacts.sql` — adds `total_contacts INTEGER` to `snapshots`.
- `supabase/migrations/20260509170400_cases_class_required.sql` — sets `case_class NOT NULL` after the rest is verified.

**Modified files:**
- `supabase/seed.sql` — set `case_class` explicitly on every `INSERT INTO cases` row; recount country_stats per-country; update snapshot row with new `total_cases` and `total_contacts`.
- `lib/types.ts` — add `CaseClass` type, `case_class` to `Case`, `total_contacts` to `Snapshot`.
- `lib/case-helpers.ts` — add `CASE_CLASS_LABEL`, `isCase()`, `isContact()` predicates and a constant array of class values that count as cases.
- `app/DashboardClient.tsx` — derive `caseRows` (case_class IN cases) and `contactRows` (contact|returnee), pass to children that need them.
- `components/ops/TopBar.tsx` — accept `caseCount` prop instead of reading `snapshot.total_cases`.
- `components/ops/KpiHud.tsx` — replace `TRACKED` row with `CONTACTS`; CASES row uses derived count.
- `components/ops/KpiGrid.tsx` — same swap on mobile (TRACKED tile → CONTACTS tile, CASES tile uses derived count).
- `components/ops/MapWithToggle.tsx` — change "X TRACKED" → "X CASES · Y CONTACTS" subtitle.
- `components/ops/MonitoringCohort.tsx` — add filter chip row (ALL · CONTACTS · RETURNEES); filter the rendered list.
- `components/ops/MobileLayout.tsx` — pass `caseRows`/`contactRows` to KpiGrid.
- `docs/runbooks/pipeline.md` — add classification rules section so the manual pipeline session classifies new cases.
- `tests/dashboard.spec.ts` — update `kpi-cases` count assertion (8 → 10), add CONTACTS row assertion, add MonitoringCohort filter chip test, add a smoke test asserting CASES chip = filtered count.
- `tests/mobile.spec.ts` — same updates for the mobile KPI grid if it asserts these labels.

---

## Phase 1: Schema (additive, non-breaking)

### Task 1: Add `case_class` enum column migration

**Files:**
- Create: `supabase/migrations/20260509170000_cases_class_enum.sql`

- [ ] **Step 1: Verify column does not exist (test)**

Run:
```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "\d cases" | grep -c case_class
```
Expected: `0` (column not present yet). If supabase isn't running locally, run `npx supabase start` first.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260509170000_cases_class_enum.sql`:

```sql
-- Adds case_class enum to disambiguate "what kind of row" (case vs. contact)
-- from the lifecycle status. See docs/superpowers/specs/2026-05-09-case-class-enum-design.md.
-- Nullable for now; backfill migration follows; NOT NULL is the last migration in this set.

ALTER TABLE cases
  ADD COLUMN case_class TEXT
    CHECK (case_class IN (
      'confirmed_case',
      'probable_case',
      'suspected_case',
      'contact',
      'returnee'
    ));

CREATE INDEX idx_cases_class ON cases (case_class);
CREATE INDEX idx_cases_class_disease ON cases (disease, case_class);
```

- [ ] **Step 3: Apply locally**

Run: `npm run db:reset`
Expected: succeeds; no migration errors. Existing seed rows leave `case_class` NULL (column is nullable).

- [ ] **Step 4: Verify column exists**

Run:
```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "\d cases" | grep case_class
```
Expected: line containing `case_class | text` and a check constraint reference.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260509170000_cases_class_enum.sql
git commit -m "Add cases.case_class column (nullable + check + indexes)"
```

---

### Task 2: Backfill migration for existing rows

**Files:**
- Create: `supabase/migrations/20260509170100_cases_class_backfill.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260509170100_cases_class_backfill.sql`:

```sql
-- Backfill case_class on pre-existing rows. No-op locally (seed runs after migrations
-- and sets case_class explicitly). Real work happens against production rows.
-- Rules per docs/superpowers/specs/2026-05-09-case-class-enum-design.md §2.

UPDATE cases
   SET case_class = 'confirmed_case'
 WHERE case_class IS NULL
   AND status IN ('confirmed', 'deceased', 'critical');

UPDATE cases
   SET case_class = 'suspected_case'
 WHERE case_class IS NULL
   AND status = 'suspected';

UPDATE cases
   SET case_class = 'returnee'
 WHERE case_class IS NULL
   AND status = 'monitoring'
   AND (case_code LIKE 'US-%' OR case_code = 'US-NE-GROUP' OR case_code LIKE 'SG-%');

UPDATE cases
   SET case_class = 'contact'
 WHERE case_class IS NULL
   AND status = 'monitoring';

-- Catch-all: rows that escaped the rules (e.g. status='recovered') default to contact.
UPDATE cases
   SET case_class = 'contact'
 WHERE case_class IS NULL;
```

- [ ] **Step 2: Apply locally**

Run: `npm run db:reset`
Expected: succeeds. Locally this migration runs against an empty `cases` table (seed has not run yet) and updates 0 rows — that's intentional.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260509170100_cases_class_backfill.sql
git commit -m "Backfill cases.case_class for pre-existing prod rows"
```

---

### Task 3: Update seed with explicit `case_class` per row

**Files:**
- Modify: `supabase/seed.sql` (the two `INSERT INTO cases` blocks)

The active cohort block starts around line 136 with columns `(case_code, status, is_index_case, role, exposure_type, age_range, sex, exposure_country, exposure_date, onset_date, confirmed_date, outcome_date, current_country, dossier, notes, source_event_id)`. The monitoring cohort block starts around line 254 with columns `(case_code, status, is_index_case, role, exposure_type, age_range, sex, exposure_country, exposure_date, current_country, dossier, notes, clearance_date)`.

- [ ] **Step 1: Verify the failing state**

Run: `npm run db:reset && psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "select case_class, count(*) from cases group by case_class order by case_class;"`
Expected: every row shows `case_class = NULL` (since neither seed nor backfill populates them yet). 14 rows, all NULL.

- [ ] **Step 2: Update active cohort INSERT — add `case_class` column**

Edit `supabase/seed.sql` around line 136. Change the column list to include `case_class` and add the value as the second column on every row.

Old column list:

```sql
INSERT INTO cases (case_code, status, is_index_case, role, exposure_type, age_range, sex,
                   exposure_country, exposure_date, onset_date, confirmed_date, outcome_date,
                   current_country, dossier, notes, source_event_id) VALUES
```

New column list (note `case_class` after `case_code`):

```sql
INSERT INTO cases (case_code, case_class, status, is_index_case, role, exposure_type, age_range, sex,
                   exposure_country, exposure_date, onset_date, confirmed_date, outcome_date,
                   current_country, dossier, notes, source_event_id) VALUES
```

Then on each row insert, add the `case_class` value as the second positional value. Per backfill rules + spec semantics:

| `case_code` | `status` | `case_class` |
|---|---|---|
| MVH-001 | deceased | `'confirmed_case'` |
| MVH-002 | deceased | `'confirmed_case'` |
| MVH-003 | confirmed | `'confirmed_case'` |
| MVH-004 | confirmed | `'confirmed_case'` |
| MVH-005 | suspected | `'suspected_case'` |
| MVH-006 | suspected | `'suspected_case'` |
| MVH-007 | suspected | `'suspected_case'` |
| MVH-008 | critical | `'confirmed_case'` |
| MVH-009 | suspected | `'suspected_case'` |
| CH-001 | confirmed | `'confirmed_case'` |

Example for the first row — change:

```sql
  ('MVH-001', 'deceased', true,  'passenger', 'rodent_contact',     '60-69', 'F', 'AR',
```

to:

```sql
  ('MVH-001', 'confirmed_case', 'deceased', true,  'passenger', 'rodent_contact',     '60-69', 'F', 'AR',
```

Apply that pattern to all 10 rows in the active cohort.

- [ ] **Step 3: Update monitoring cohort INSERT**

Edit `supabase/seed.sql` around line 254. Same pattern — add `case_class` as the second column in the column list and as the second value on each row.

Old column list:

```sql
INSERT INTO cases (case_code, status, is_index_case, role, exposure_type, age_range, sex,
                   exposure_country, exposure_date, current_country, dossier, notes,
                   clearance_date) VALUES
```

New column list:

```sql
INSERT INTO cases (case_code, case_class, status, is_index_case, role, exposure_type, age_range, sex,
                   exposure_country, exposure_date, current_country, dossier, notes,
                   clearance_date) VALUES
```

Per backfill rules, all four monitoring rows are `'contact'`:

| `case_code` | `case_class` |
|---|---|
| NJ-MON-001 | `'contact'` |
| NJ-MON-002 | `'contact'` |
| KL592-MON-001 | `'contact'` |
| KL592-MON-002 | `'contact'` |

Example: change

```sql
  ('NJ-MON-001', 'monitoring', false, 'contact', 'person_to_person', '40-49', 'F', 'US',
```

to

```sql
  ('NJ-MON-001', 'contact', 'monitoring', false, 'contact', 'person_to_person', '40-49', 'F', 'US',
```

Note the visual confusion: the second `'contact'` is the `role` column (already there), and the new first one is `case_class`. Both happen to equal `'contact'` for this row — that is correct.

- [ ] **Step 4: Verify**

Run: `npm run db:reset && psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "select case_class, count(*) from cases group by case_class order by case_class;"`
Expected:
```
 case_class      | count
-----------------+-------
 confirmed_case  |     6
 contact         |     4
 suspected_case  |     4
```
14 rows total, no NULLs.

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql
git commit -m "Seed: set case_class explicitly on all cases rows"
```

---

## Phase 2: Types + helpers

### Task 4: Add `CaseClass` type and field on `Case`

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Edit `lib/types.ts`**

Find the `CaseStatus` type around line 79 and add `CaseClass` immediately after it:

```ts
export type CaseStatus = 'monitoring' | 'suspected' | 'confirmed' | 'recovered' | 'deceased' | 'critical';
export type CaseClass = 'confirmed_case' | 'probable_case' | 'suspected_case' | 'contact' | 'returnee';
export type CaseRole = 'passenger' | 'crew' | 'contact' | 'healthcare_worker' | 'rural_resident' | 'other';
```

Then add `case_class: CaseClass` to the `Case` interface (around line 89, immediately after `status: CaseStatus;`):

```ts
  status: CaseStatus;
  case_class: CaseClass;
  is_index_case: boolean;
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: passes. No callers reference `case_class` yet, so adding the required field shouldn't break anything that constructs `Case` objects (the only construction sites are the Supabase client, which infers from row shape).

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "Types: add CaseClass + case_class field to Case"
```

---

### Task 5: Add case-class helpers

**Files:**
- Modify: `lib/case-helpers.ts`

- [ ] **Step 1: Append helpers to `lib/case-helpers.ts`**

Add these exports near the end of the file (after the existing helpers, before the final closing `}` of the last function or at the bottom of the module):

```ts
import type { CaseClass } from './types';

export const CASE_CLASS_LABEL: Record<CaseClass, string> = {
  confirmed_case: 'CONFIRMED',
  probable_case: 'PROBABLE',
  suspected_case: 'SUSPECTED',
  contact: 'CONTACT',
  returnee: 'RETURNEE',
};

// Classes that count toward the CASES tally (per spec §3 + §8 resolution).
export const CASE_CLASSES_AS_CASES: readonly CaseClass[] = [
  'confirmed_case',
  'probable_case',
  'suspected_case',
];

export function isCase(c: { case_class: CaseClass }): boolean {
  return CASE_CLASSES_AS_CASES.includes(c.case_class);
}

export function isContact(c: { case_class: CaseClass }): boolean {
  return c.case_class === 'contact' || c.case_class === 'returnee';
}
```

If `CaseClass` is already imported via the existing `import type { Case, CaseLocation, CaseStatus } from './types';` line, extend that line instead of adding a new import:

```ts
import type { Case, CaseClass, CaseLocation, CaseStatus } from './types';
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add lib/case-helpers.ts
git commit -m "Helpers: add CASE_CLASS_LABEL + isCase/isContact predicates"
```

---

## Phase 3: UI updates

### Task 6: KpiHud — replace TRACKED row with CONTACTS, derive CASES from cases array

**Files:**
- Modify: `components/ops/KpiHud.tsx`
- Modify: `tests/dashboard.spec.ts`

- [ ] **Step 1: Add a failing Playwright assertion**

Open `tests/dashboard.spec.ts` and find the `'ops console renders sit-rep + tabs'` test. The line currently asserting `kpi-cases` text is:

```ts
await expect(desktop.getByTestId('kpi-cases')).toContainText('8');
```

There is no `kpi-cases` testid in `KpiHud` today (it's only in `KpiGrid` — see Task 7). For the desktop HUD we instead assert the visible row text. Add this new test below the existing 'ops console' test in `tests/dashboard.spec.ts`:

```ts
test('KPI HUD shows CASES (derived) and CONTACTS (no longer TRACKED)', async ({ page }) => {
  await page.goto('/');
  const desktop = page.getByTestId('desktop-layout');
  const hud = desktop.getByText('KEY METRICS').locator('xpath=ancestor::div[contains(@class,"absolute")]');
  await expect(hud.getByText('CASES', { exact: true })).toBeVisible();
  await expect(hud.getByText('CONTACTS', { exact: true })).toBeVisible();
  await expect(hud.getByText('TRACKED', { exact: true })).toHaveCount(0);
  // Seed: 6 confirmed_case + 4 suspected_case = 10 cases; 4 contacts.
  await expect(hud.getByText(/CASES\s*10/)).toBeVisible();
  await expect(hud.getByText(/CONTACTS\s*4/)).toBeVisible();
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx playwright test tests/dashboard.spec.ts -g "KPI HUD shows CASES"`
Expected: FAIL — "TRACKED" still rendered, "CONTACTS" missing.

- [ ] **Step 3: Update `KpiHud.tsx`**

Replace the body of `KpiHud` so it derives counts from the `cases` array. The full updated file:

```tsx
'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Snapshot, Case } from '@/lib/types';
import { formatNumber, formatPercent } from '@/lib/format';
import { isCase, isContact } from '@/lib/case-helpers';

interface Props {
  snapshot: Snapshot | null;
  prevSnapshot: Snapshot | null;
  cases: Case[];
}

function delta(curr: number | null | undefined, prev: number | null | undefined, unit: 'abs' | 'pct' | 'pp') {
  if (curr == null || prev == null) return null;
  const d = curr - prev;
  if (d === 0) return null;
  const arrow = d > 0 ? '▲' : '▼';
  const tone: 'good' | 'bad' = d > 0 ? 'bad' : 'good';
  if (unit === 'abs') return { text: `${arrow} ${d > 0 ? '+' : ''}${d}`, tone };
  if (unit === 'pp') return { text: `${arrow} ${d > 0 ? '+' : ''}${(d * 100).toFixed(1)}pp`, tone };
  const pct = prev === 0 ? 0 : (d / prev) * 100;
  return { text: `${arrow} ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, tone };
}

function Row({
  label,
  value,
  d,
}: {
  label: string;
  value: string;
  d: { text: string; tone: 'good' | 'bad' } | null;
}) {
  const cls = d?.tone === 'good' ? 'text-green' : d?.tone === 'bad' ? 'text-red' : '';
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-1.5 font-mono text-[11px]">
      <span className="text-text-muted/80">{label}</span>
      <span className="flex items-baseline gap-2">
        {d && <span className={`text-[10px] ${cls}`}>{d.text}</span>}
        <span className="tabular-nums text-text/95">{value}</span>
      </span>
    </div>
  );
}

export function KpiHud({ snapshot, prevSnapshot, cases }: Props) {
  const [open, setOpen] = useState(true);
  const caseCount = cases.filter(isCase).length;
  const contactCount = cases.filter(isContact).length;
  const deaths = snapshot?.total_deaths ?? null;
  const cfr = snapshot?.fatality_rate ?? null;
  const countries = snapshot?.countries_affected ?? null;
  const dCases = delta(caseCount, prevSnapshot?.total_cases, 'pct');
  const dDeaths = delta(deaths, prevSnapshot?.total_deaths, 'pct');
  const dCfr = delta(cfr, prevSnapshot?.fatality_rate, 'pp');
  const dCountries = delta(countries, prevSnapshot?.countries_affected, 'abs');

  return (
    <div className="pointer-events-auto absolute right-3 top-3 z-10 w-[240px] overflow-hidden rounded-sm border border-white/10 bg-bg-2/40 shadow-xl backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between border-b border-white/10 px-3 py-1.5 text-left hover:bg-white/5"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted/80">KEY METRICS</span>
        {open ? <ChevronUp size={12} className="text-text-muted/70" /> : <ChevronDown size={12} className="text-text-muted/70" />}
      </button>
      {open && (
        <div className="divide-y divide-white/5">
          <Row label="CASES" value={formatNumber(caseCount)} d={dCases} />
          <Row label="CONTACTS" value={formatNumber(contactCount)} d={null} />
          <Row label="DEATHS" value={formatNumber(deaths)} d={dDeaths} />
          <Row label="FATALITY RATE" value={formatPercent(cfr)} d={dCfr} />
          <Row label="COUNTRIES" value={formatNumber(countries)} d={dCountries} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx playwright test tests/dashboard.spec.ts -g "KPI HUD shows CASES"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ops/KpiHud.tsx tests/dashboard.spec.ts
git commit -m "KpiHud: replace TRACKED with CONTACTS; derive CASES from case_class"
```

---

### Task 7: KpiGrid (mobile) — same swap

**Files:**
- Modify: `components/ops/KpiGrid.tsx`
- Modify: `tests/mobile.spec.ts`
- Modify: `tests/dashboard.spec.ts` (the `kpi-cases` count assertion lives in the desktop test)

- [ ] **Step 1: Update the existing dashboard `kpi-cases` test value**

Wait — `kpi-cases` testid is on `KpiGrid`, which renders inside `MobileLayout`. The existing dashboard.spec.ts assertion `kpi-cases` toContainText('8') is querying through `desktop` scope but that scope contains only the desktop layout (per the test file's comment). Confirm with:

```bash
grep -n "kpi-cases\|KpiGrid\|MobileLayout" /Users/claude/Projects/project_contagion/components/ops/KpiGrid.tsx /Users/claude/Projects/project_contagion/components/ops/MobileLayout.tsx
```

Expected: `KpiGrid` is imported only by `MobileLayout`; `kpi-cases` testid is only on `KpiGrid`.

If the existing `kpi-cases` assertion is inside `desktop` scope, it currently passes only because `getByTestId` matches the hidden mobile DOM. After this task it will continue to match — the value just changes. Update the assertion in `tests/dashboard.spec.ts`:

Change:

```ts
await expect(desktop.getByTestId('kpi-cases')).toContainText('8');
```

to:

```ts
await expect(desktop.getByTestId('kpi-cases')).toContainText('10');
```

(`6 confirmed + 4 suspected = 10` per the seed.)

- [ ] **Step 2: Add a mobile-scoped Playwright test for the new tile labels**

Open `tests/mobile.spec.ts` and add a new test that scopes the queries to the mobile layout and asserts:
- `CASES` tile shows `10`
- `CONTACTS` tile is present (replacing `TRACKED`)
- `TRACKED` tile is no longer present

```ts
test('mobile KPI grid shows CASES + CONTACTS (no TRACKED)', async ({ page, viewport }) => {
  // The mobile layout is gated below the lg breakpoint; ensure we're on mobile.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByTestId('kpi-cases')).toContainText('10');
  await expect(page.getByText('CONTACTS', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('TRACKED', { exact: true })).toHaveCount(0);
});
```

- [ ] **Step 3: Run both tests to confirm they fail**

Run: `npx playwright test -g "kpi"`
Expected: both new assertions FAIL — current value is 8 (snapshot.total_cases) and the tile still says TRACKED.

- [ ] **Step 4: Update `KpiGrid.tsx`**

Full file:

```tsx
import type { Snapshot, Case } from '@/lib/types';
import { formatNumber, formatPercent } from '@/lib/format';
import { isCase, isContact } from '@/lib/case-helpers';
import { SectionHeader } from './SectionHeader';
import { KpiTile } from './KpiTile';

function delta(
  curr: number | null | undefined,
  prev: number | null | undefined,
  unit: 'abs' | 'pct' | 'pp',
): { text: string; tone: 'good' | 'bad' | 'neutral' } | null {
  if (curr == null || prev == null) return null;
  const d = curr - prev;
  if (d === 0) return null;
  const arrow = d > 0 ? '▲' : '▼';
  const tone: 'good' | 'bad' | 'neutral' = d > 0 ? 'bad' : 'good';
  if (unit === 'abs') return { text: `${arrow} ${d > 0 ? '+' : ''}${d}`, tone };
  if (unit === 'pp') return { text: `${arrow} ${d > 0 ? '+' : ''}${(d * 100).toFixed(1)}pp`, tone };
  const pct = prev === 0 ? 0 : (d / prev) * 100;
  return { text: `${arrow} ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, tone };
}

export function KpiGrid({
  snapshot,
  prevSnapshot,
  cases: caseRows,
}: {
  snapshot: Snapshot | null;
  prevSnapshot: Snapshot | null;
  cases: Case[];
}) {
  const cases = caseRows.filter(isCase).length;
  const contacts = caseRows.filter(isContact).length;
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
      <div className="mt-3 grid grid-cols-2 gap-2">
        <KpiTile
          testId="kpi-cases"
          label="CASES"
          value={formatNumber(cases)}
          subtitle="CONFIRMED + PROBABLE + SUSPECTED"
          delta={dCases?.text}
          deltaTone={dCases?.tone}
        />
        <KpiTile
          testId="kpi-contacts"
          label="CONTACTS"
          value={formatNumber(contacts)}
          subtitle="MONITORED CONTACTS + RETURNEES"
        />
        <KpiTile testId="kpi-deaths" label="DEATHS" value={formatNumber(deaths)} delta={dDeaths?.text} deltaTone={dDeaths?.tone} />
        <KpiTile testId="kpi-cfr" label="FATALITY RATE" value={formatPercent(cfr)} delta={dCfr?.text} deltaTone={dCfr?.tone} />
        <KpiTile testId="kpi-countries" label="COUNTRIES" value={formatNumber(countries)} delta={dCountries?.text} deltaTone="neutral" />
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run all kpi tests**

Run: `npx playwright test -g "kpi"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/ops/KpiGrid.tsx tests/dashboard.spec.ts tests/mobile.spec.ts
git commit -m "KpiGrid: TRACKED tile -> CONTACTS tile; CASES uses case_class"
```

---

### Task 8: TopBar — derive CASES chip from cases array

**Files:**
- Modify: `components/ops/TopBar.tsx`
- Modify: `app/DashboardClient.tsx`
- Modify: `tests/dashboard.spec.ts`

- [ ] **Step 1: Add a failing Playwright assertion**

The TopBar `CASES X` chip is rendered with text like `CASES 8`. After this change it should show `CASES 10`.

Add this test in `tests/dashboard.spec.ts`:

```ts
test('TopBar CASES chip uses case_class-derived count', async ({ page }) => {
  await page.goto('/');
  // Topbar lives outside the desktop-layout testid, but the chip is hidden on mobile (lg:flex).
  // Use a desktop viewport (default) and a regex to handle whitespace.
  await expect(page.getByText(/CASES\s+10/).first()).toBeVisible();
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx playwright test tests/dashboard.spec.ts -g "TopBar CASES chip"`
Expected: FAIL — current value is 8.

- [ ] **Step 3: Update `TopBar.tsx`** to accept a `caseCount` prop

Replace the existing prop interface and the CASES chip line. The relevant changes:

```tsx
export function TopBar({
  snapshot,
  threat,
  monitoringCount,
  caseCount,
}: {
  snapshot: Snapshot | null;
  threat: ThreatAssessment | null;
  monitoringCount: number;
  caseCount: number;
}) {
  // ... unchanged code above ...
```

And change the CASES chip:

```tsx
        <span className="border-l border-border pl-4">
          CASES <span className="tabular-nums text-text">{caseCount}</span>
        </span>
```

(Replaces `{snapshot?.total_cases ?? '—'}` with `{caseCount}`.)

- [ ] **Step 4: Update `app/DashboardClient.tsx`** to pass `caseCount`

Find the `<TopBar ... />` usage and the existing derivations around line 162:

```tsx
  const activeCases = cases.filter((c) => c.status !== 'monitoring');
  const monitoringCases = cases.filter((c) => c.status === 'monitoring');
```

Add the new derivations and pass to TopBar:

```tsx
  const activeCases = cases.filter((c) => c.status !== 'monitoring');
  const monitoringCases = cases.filter((c) => c.status === 'monitoring');
  const caseRows = cases.filter(isCase);
  const contactRows = cases.filter(isContact);
```

Add the import at the top of the file:

```tsx
import { isCase, isContact } from '@/lib/case-helpers';
```

Then:

```tsx
      <TopBar snapshot={snapshot} threat={threat} monitoringCount={monitoringCases.length} caseCount={caseRows.length} />
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx playwright test tests/dashboard.spec.ts -g "TopBar CASES chip"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/ops/TopBar.tsx app/DashboardClient.tsx tests/dashboard.spec.ts
git commit -m "TopBar: CASES chip uses case_class-derived count, not snapshot.total_cases"
```

---

### Task 9: MapWithToggle — replace TRACKED with CASES + CONTACTS subtitle

**Files:**
- Modify: `components/ops/MapWithToggle.tsx`
- Modify: `components/ops/MobileLayout.tsx` (pass `caseRows`/`contactRows`)
- Modify: `tests/mobile.spec.ts`

- [ ] **Step 1: Add a failing Playwright assertion**

In `tests/mobile.spec.ts` add:

```ts
test('MapWithToggle subtitle shows CASES and CONTACTS counts (no TRACKED)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByText(/10\s+CASES.*4\s+CONTACTS/i)).toBeVisible();
  await expect(page.getByText(/TRACKED/)).toHaveCount(0);
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx playwright test tests/mobile.spec.ts -g "MapWithToggle subtitle"`
Expected: FAIL — current subtitle is `{cases.length} TRACKED · {countries.length} COUNTRIES`.

- [ ] **Step 3: Update `MapWithToggle.tsx`**

Change the props interface and subtitle line. New props:

```tsx
interface Props {
  countries: CountryStat[];
  cases: Case[];
  caseLocations: CaseLocation[];
  selectedCaseId: string | null;
  caseCount: number;
  contactCount: number;
}

export function MapWithToggle({ countries, cases, caseLocations, selectedCaseId, caseCount, contactCount }: Props) {
```

Change the subtitle span:

```tsx
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
          {caseCount} CASES · {contactCount} CONTACTS · {countries.length} COUNTRIES
        </span>
```

- [ ] **Step 4: Update `MobileLayout.tsx` to pass the new props**

Find where `MapWithToggle` is rendered. Update the props passed:

```tsx
      <MapWithToggle
        countries={countries}
        cases={cases}
        caseLocations={caseLocations}
        selectedCaseId={selectedCaseId}
        caseCount={caseRows.length}
        contactCount={contactRows.length}
      />
```

Add the derivation at the top of `MobileLayout`'s function body (using helpers from `@/lib/case-helpers`):

```tsx
import { isCase, isContact } from '@/lib/case-helpers';

// inside the component:
  const caseRows = cases.filter(isCase);
  const contactRows = cases.filter(isContact);
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx playwright test tests/mobile.spec.ts -g "MapWithToggle subtitle"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/ops/MapWithToggle.tsx components/ops/MobileLayout.tsx tests/mobile.spec.ts
git commit -m "MapWithToggle: subtitle shows CASES + CONTACTS, not TRACKED"
```

---

### Task 10: MonitoringCohort — filter chips (ALL · CONTACTS · RETURNEES)

**Files:**
- Modify: `components/ops/MonitoringCohort.tsx`
- Modify: `tests/dashboard.spec.ts`

- [ ] **Step 1: Add a failing Playwright assertion**

In `tests/dashboard.spec.ts` add:

```ts
test('MonitoringCohort has ALL/CONTACTS/RETURNEES filter chips', async ({ page }) => {
  await page.goto('/');
  const desktop = page.getByTestId('desktop-layout');
  const monitoring = desktop.getByText('MONITORING', { exact: true }).locator('xpath=ancestor::section[1]');
  await expect(monitoring.getByRole('button', { name: 'ALL' })).toBeVisible();
  await expect(monitoring.getByRole('button', { name: 'CONTACTS' })).toBeVisible();
  await expect(monitoring.getByRole('button', { name: 'RETURNEES' })).toBeVisible();
  // Default ALL: 4 rows visible (4 contacts in seed).
  await expect(monitoring.getByText('NJ-MON-001')).toBeVisible();
  await expect(monitoring.getByText('KL592-MON-001')).toBeVisible();
  // Click RETURNEES: list becomes empty (no returnees in seed).
  await monitoring.getByRole('button', { name: 'RETURNEES' }).click();
  await expect(monitoring.getByText('NJ-MON-001')).toHaveCount(0);
  // Click CONTACTS: 4 contacts visible again.
  await monitoring.getByRole('button', { name: 'CONTACTS' }).click();
  await expect(monitoring.getByText('NJ-MON-001')).toBeVisible();
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx playwright test tests/dashboard.spec.ts -g "MonitoringCohort has"`
Expected: FAIL — chips don't exist.

- [ ] **Step 3: Update `MonitoringCohort.tsx`**

Add filter state and chip row. Updated file:

```tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Case, CaseClass } from '@/lib/types';
import { clearanceFor, caseLabel } from '@/lib/case-helpers';
import { SectionHeader } from './SectionHeader';

const TONE_CLS: Record<string, string> = {
  green:   'border-green text-green',
  amber:   'border-amber text-amber',
  orange:  'border-orange text-orange',
  red:     'border-red text-red',
  cleared: 'border-text-muted text-text-muted',
};

type Filter = 'all' | 'contact' | 'returnee';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'contact', label: 'CONTACTS' },
  { id: 'returnee', label: 'RETURNEES' },
];

function matches(c: Case, filter: Filter): boolean {
  if (filter === 'all') return true;
  return c.case_class === (filter as CaseClass);
}

export function MonitoringCohort({ cases }: { cases: Case[] }) {
  const [filter, setFilter] = useState<Filter>('all');

  if (cases.length === 0) {
    return (
      <section className="px-4 py-4">
        <SectionHeader>MONITORING</SectionHeader>
        <p className="mt-2 text-sm text-text-muted">No people in active monitoring.</p>
      </section>
    );
  }

  const filtered = cases.filter((c) => matches(c, filter));
  const ranked = [...filtered].sort((a, b) => {
    const ca = clearanceFor(a.clearance_date, a.exposure_date);
    const cb = clearanceFor(b.clearance_date, b.exposure_date);
    const da = ca?.daysRemaining ?? Number.POSITIVE_INFINITY;
    const db = cb?.daysRemaining ?? Number.POSITIVE_INFINITY;
    return da - db;
  });
  const closingSoon = ranked.filter((c) => {
    const r = clearanceFor(c.clearance_date, c.exposure_date);
    return r && !r.cleared && r.daysRemaining < 7;
  }).length;

  return (
    <section className="px-4 py-4">
      <div className="flex items-baseline justify-between">
        <SectionHeader>MONITORING</SectionHeader>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
          {ranked.length} TOTAL{closingSoon > 0 ? ` · ${closingSoon} <7D` : ''}
        </span>
      </div>
      <div className="mt-2 flex gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`border px-2 py-0.5 font-mono text-[10px] tracking-[0.1em] ${
              filter === f.id
                ? 'border-green text-green'
                : 'border-border text-text-muted hover:text-text'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {ranked.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">No matches.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {ranked.map((c) => {
            const r = clearanceFor(c.clearance_date, c.exposure_date);
            const tone = r?.tone ?? 'cleared';
            const days = r ? (r.cleared ? 'CLEARED' : `${r.daysRemaining}D`) : '—';
            const where = c.exposure_country ? `· ${c.exposure_country}` : '';
            return (
              <li key={c.id}>
                <Link
                  href={`/?case=${c.case_code}`}
                  className="flex items-center gap-2 border border-border bg-surface px-2 py-1.5 hover:bg-surface-2"
                  scroll={false}
                >
                  <span className="truncate font-mono text-[11px] text-text">{caseLabel(c)}</span>
                  <span className="truncate text-[11px] text-text-secondary">
                    {c.role ? c.role.replace('_', ' ').toUpperCase() : 'CONTACT'} {where}
                  </span>
                  <span
                    className={`ml-auto inline-flex items-center border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.1em] ${TONE_CLS[tone]}`}
                    title={r?.totalWindowDays ? `${r.totalWindowDays}-day exposure window` : undefined}
                  >
                    {days}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx playwright test tests/dashboard.spec.ts -g "MonitoringCohort has"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ops/MonitoringCohort.tsx tests/dashboard.spec.ts
git commit -m "MonitoringCohort: ALL / CONTACTS / RETURNEES filter chips"
```

---

## Phase 4: Country recount + snapshot total_contacts + NOT NULL

### Task 11: Country stats recount migration + seed update

**Files:**
- Create: `supabase/migrations/20260509170200_country_stats_recount.sql`
- Modify: `supabase/seed.sql` (country_stats section, lines 9-19)

- [ ] **Step 1: Write the recount migration**

Create `supabase/migrations/20260509170200_country_stats_recount.sql`:

```sql
-- Recount country_stats.cases from cases by class, keyed on current_country.
-- Per spec §3.5 + §8 resolution: "where the case is now" matches map markers
-- and the PostureMatrix list semantics. case_class IN (confirmed, probable, suspected).

UPDATE country_stats cs
SET cases = (
  SELECT count(*) FROM cases c
  WHERE c.disease = cs.disease
    AND c.current_country = cs.country_code
    AND c.case_class IN ('confirmed_case','probable_case','suspected_case')
);
```

- [ ] **Step 2: Update seed `country_stats` to match new semantics**

Per the cases table after Task 3 the `current_country` distribution of cases-classes is:
- `NL`: MVH-001, MVH-002 → 2
- `CH`: MVH-009 (suspected), CH-001 (confirmed) → 2
- `CV`: MVH-003, MVH-004, MVH-008 (all confirmed/critical) → 3
- `US`: MVH-005, MVH-006, MVH-007 (all suspected) → 3
- `AR`, `CL`, `ES`, `SG`, `ZA`, `CA`: 0

Edit `supabase/seed.sql` lines 10-19. Change just the `cases` integer (4th positional value in each row, between `country_name` and `deaths`):

| `country_code` | old `cases` | new `cases` |
|---|---|---|
| AR | 2 | 0 |
| CL | 1 | 0 |
| NL | 2 | 2 |
| CH | 1 | 2 |
| CV | 2 | 3 |
| US | 0 | 3 |
| ES | 0 | 0 |
| SG | 0 | 0 |
| ZA | 0 | 0 |
| CA | 0 | 0 |

Example diff for the AR row:

```sql
-- old
  ('hantavirus','AR','Argentina',2,0,'2026-04-06','2026-04-28','monitoring','CDC Level 2: Practice Enhanced Precautions in Patagonia','Index exposure: Dutch couple birdwatching near Ushuaia'),
-- new
  ('hantavirus','AR','Argentina',0,0,'2026-04-06','2026-04-28','monitoring','CDC Level 2: Practice Enhanced Precautions in Patagonia','Index exposure: Dutch couple birdwatching near Ushuaia'),
```

Repeat for the rows where the value changes (AR 2→0, CL 1→0, CH 1→2, CV 2→3, US 0→3).

- [ ] **Step 3: Apply and verify**

Run: `npm run db:reset && psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "select country_code, cases from country_stats order by country_code;"`
Expected: AR=0, CA=0, CH=2, CL=0, CV=3, ES=0, NL=2, SG=0, US=3, ZA=0. Sum = 10, matches CASES.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260509170200_country_stats_recount.sql supabase/seed.sql
git commit -m "country_stats.cases: recount by case_class on current_country"
```

---

### Task 12: Add `total_contacts` column to snapshots + types + seed

**Files:**
- Create: `supabase/migrations/20260509170300_snapshots_total_contacts.sql`
- Modify: `lib/types.ts`
- Modify: `supabase/seed.sql` (snapshot row + total_cases)
- Modify: `tests/dashboard.spec.ts` (snapshot CASES already updated in Task 7)

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260509170300_snapshots_total_contacts.sql`:

```sql
-- Adds a parallel headline number for contacts/returnees alongside total_cases.
-- Pipeline writes both; UI derives display values from cases when needed.

ALTER TABLE snapshots ADD COLUMN total_contacts INTEGER;
```

- [ ] **Step 2: Update `lib/types.ts`**

Add `total_contacts: number | null;` to the `Snapshot` interface, immediately after `total_cases: number | null;`:

```ts
export interface Snapshot {
  id: string;
  created_at: string;
  disease: string;
  total_cases: number | null;
  total_contacts: number | null;
  total_deaths: number | null;
  // ... rest unchanged
```

- [ ] **Step 3: Update `supabase/seed.sql` snapshot row**

Find the snapshot insert around line 120. Update the column list and values: add `total_contacts` after `total_cases`, change `total_cases` value from `8` to `10`, and set `total_contacts` to `4`.

Old:

```sql
INSERT INTO snapshots (disease, total_cases, total_deaths, countries_affected, countries_list, fatality_rate, trend, trend_description, risk_level, key_developments, ai_analysis) VALUES
  ('hantavirus', 8, 3, 5, ARRAY['AR','CL','NL','CH','CV'], 0.375, 'accelerating',
```

New:

```sql
INSERT INTO snapshots (disease, total_cases, total_contacts, total_deaths, countries_affected, countries_list, fatality_rate, trend, trend_description, risk_level, key_developments, ai_analysis) VALUES
  ('hantavirus', 10, 4, 3, 5, ARRAY['AR','CL','NL','CH','CV'], 0.30, 'accelerating',
```

Note: `total_cases` 8 → 10 (now means confirmed+probable+suspected per spec §3.6), `total_contacts` 4 (the four monitoring contacts), `fatality_rate` 0.375 → 0.30 (3 deaths / 10 cases). Update the narrative `ai_analysis` text only if a future task requires it; for now the number change in the field is enough — the dashboard derives the displayed CFR from `snapshot.fatality_rate`, so the value 0.30 will render correctly.

- [ ] **Step 4: Apply and verify**

Run: `npm run db:reset && psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "select total_cases, total_contacts, total_deaths, fatality_rate from snapshots order by created_at desc limit 1;"`
Expected: `10 | 4 | 3 | 0.300`.

- [ ] **Step 5: Run the existing smoke suite**

Run: `npm run typecheck && npx playwright test`
Expected: All previously-updated tests pass. The fatality rate displayed by `KpiHud` now reads from `snapshot.fatality_rate = 0.30` so any test asserting `37%` or `~37` would need updating — search and update if found.

```bash
grep -n "37\|0\.375" tests/
```

If any test references `37%` or `0.375`, update the expected value to `30%` / `0.30`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260509170300_snapshots_total_contacts.sql lib/types.ts supabase/seed.sql tests/
git commit -m "snapshots.total_contacts: column + seed; total_cases adopts confirmed+probable+suspected"
```

---

### Task 13: NOT NULL migration

**Files:**
- Create: `supabase/migrations/20260509170400_cases_class_required.sql`

- [ ] **Step 1: Verify no NULLs exist**

Run: `npm run db:reset && psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "select count(*) from cases where case_class is null;"`
Expected: `0`.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260509170400_cases_class_required.sql`:

```sql
-- Lock case_class as required after backfill + seed coverage are confirmed.
-- Production: run only after the operator has verified zero NULLs via:
--   select count(*) from cases where case_class is null;

ALTER TABLE cases ALTER COLUMN case_class SET NOT NULL;
```

- [ ] **Step 3: Apply locally**

Run: `npm run db:reset`
Expected: succeeds. The constraint is added at the end of migration order; seed inserts include `case_class` (Task 3) so no NOT NULL violation occurs.

- [ ] **Step 4: Verify constraint**

Run: `psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "\d cases" | grep case_class`
Expected: line shows `case_class | text |  | not null` (no nullable).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260509170400_cases_class_required.sql
git commit -m "cases.case_class: SET NOT NULL"
```

---

## Phase 5: Pipeline runbook + verification

### Task 14: Pipeline runbook — classification rules

**Files:**
- Modify: `docs/runbooks/pipeline.md`

- [ ] **Step 1: Read the current runbook**

Run: `grep -n "case_class\|confirmed\|monitoring\|status" docs/runbooks/pipeline.md | head -30`
Expected: no `case_class` references currently. Identify a sensible insertion point (likely near the section that describes how a new case row is written).

- [ ] **Step 2: Append a new section to `docs/runbooks/pipeline.md`**

Add a `## Case classification` section. Drop in this content:

```markdown
## Case classification

Every `cases` row has two orthogonal columns:

- `status` — lifecycle: `monitoring | suspected | confirmed | recovered | deceased | critical`
- `case_class` — what the row represents:
  - `confirmed_case` — Tier-1 source explicitly says PCR-confirmed or lab-positive.
  - `probable_case` — Tier-1 source describes the case as probable / postmortem-positive / strong epi link without lab.
  - `suspected_case` — Symptomatic but neither lab-confirmed nor probable per source.
  - `contact` — Known direct exposure to a case but not yet symptomatic-and-tested.
  - `returnee` — Returned from an exposure area without known direct contact (precautionary).

When writing a new row, always set both. Allowed combinations:

- `confirmed_case` × `monitoring | recovered | deceased | critical`
- `probable_case` × `monitoring | recovered | deceased`
- `suspected_case` × `suspected | monitoring | recovered`
- `contact` × `monitoring | recovered` only — promote to `confirmed_case` if the contact tests positive
- `returnee` × `monitoring | recovered` only — same promotion rule

Promotion is operator-driven for now. If a contact tests positive, write an UPDATE that flips `case_class` to `confirmed_case` AND adjusts `status` accordingly. Don't leave a contact in `confirmed`/`deceased`/`critical` lifecycle states.

The dashboard counts:

- CASES = rows with `case_class IN ('confirmed_case','probable_case','suspected_case')`
- CONTACTS = rows with `case_class IN ('contact','returnee')`
- `country_stats.cases` is keyed on `current_country` (where the row is now), not exposure_country.
```

- [ ] **Step 3: Commit**

```bash
git add docs/runbooks/pipeline.md
git commit -m "Pipeline runbook: case_class classification rules"
```

---

### Task 15: Smoke verification + final test sweep

**Files:**
- Modify: `tests/dashboard.spec.ts` (add cross-cutting smoke)

- [ ] **Step 1: Add a cross-cutting smoke that asserts CASES chip = filtered count**

Append this test to `tests/dashboard.spec.ts`:

```ts
test('smoke: CASES displayed = sum of case_class IN (confirmed,probable,suspected)', async ({ page }) => {
  await page.goto('/');
  // Topbar chip
  const topbarChip = page.getByText(/^CASES\s+\d+$/).first();
  await expect(topbarChip).toBeVisible();
  const topbarText = (await topbarChip.textContent()) ?? '';
  const topbarCount = Number(topbarText.replace(/\D/g, ''));

  // Mobile KPI tile (rendered in DOM but hidden on desktop viewport)
  await expect(page.getByTestId('kpi-cases')).toContainText(String(topbarCount));

  // Sanity: derived value should be 10 from seed (6 confirmed + 4 suspected).
  expect(topbarCount).toBe(10);
});
```

- [ ] **Step 2: Run the full smoke suite**

Run: `npm run test:smoke`
Expected: all tests pass, including:
- `ops console renders sit-rep + tabs` (kpi-cases now 10)
- `KPI HUD shows CASES (derived) and CONTACTS`
- `mobile KPI grid shows CASES + CONTACTS`
- `MapWithToggle subtitle shows CASES and CONTACTS counts`
- `MonitoringCohort has ALL/CONTACTS/RETURNEES filter chips`
- `TopBar CASES chip uses case_class-derived count`
- `smoke: CASES displayed = sum of case_class`

If any test fails, fix the failure (likely a stale value or selector) before committing.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 4: Manual verification (matches spec §9)**

Run each query and confirm:

```bash
# 1. Sensible class distribution
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -c "select case_class, count(*) from cases group by case_class order by case_class;"
# Expected: confirmed_case=6, contact=4, suspected_case=4

# 2. Country recount matches CASES
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -c "select sum(cases) from country_stats;"
# Expected: 10

# 3. Snapshot pair
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -c "select total_cases, total_contacts from snapshots order by created_at desc limit 1;"
# Expected: 10 | 4
```

- [ ] **Step 5: Commit**

```bash
git add tests/dashboard.spec.ts
git commit -m "Smoke: assert CASES chip = case_class-filtered count"
```

---

## Self-Review

**Spec coverage:**
- §1 Schema — Tasks 1, 13 ✓
- §2 Backfill — Tasks 2, 3 ✓
- §3 UI — Tasks 6, 7, 8, 9, 10 ✓
- §3.5 country_stats recount — Task 11 ✓
- §3.6 snapshots.total_contacts — Task 12 ✓
- §4 Pipeline — Task 14 ✓
- §6 4-migration summary — Tasks 1, 2, 11, 12, 13 (5 migrations; spec listed 4 but recount is needed per §3.5 → expanded to 5) ✓
- §9 Verification — Task 15 ✓

**Placeholder scan:** No `<TS>` or `TBD` left. All migration filenames and SQL bodies are concrete. All TS field names match (`case_class`, `total_contacts`, `caseCount`, `contactCount`, `caseRows`, `contactRows`).

**Type consistency:**
- `CaseClass` defined in Task 4, used in Tasks 5, 10.
- `isCase` / `isContact` defined in Task 5, used in Tasks 6, 7, 8, 9.
- Prop names (`caseCount`, `contactCount`) consistent across `TopBar`, `MapWithToggle`, and the Dashboard derivations.

**Migration ordering:**
- 170000 enum (nullable) — Task 1
- 170100 backfill — Task 2
- 170200 country recount — Task 11
- 170300 snapshots.total_contacts — Task 12
- 170400 NOT NULL — Task 13

The NOT NULL migration is last so all UI/seed updates ship before the constraint hardens.

**Edge cases checked:**
- Seed runs after migrations, so `NOT NULL` constraint is satisfied by Task 3's explicit `case_class` columns.
- Backfill migration is a no-op on local (rows don't exist when it runs) but operates on production rows that pre-date the column. Verified by the catch-all `WHERE case_class IS NULL` clauses.
- `country_stats` recount migration is no-op locally because seed values already match new semantics; on production, rows pre-exist and the migration adjusts them.
