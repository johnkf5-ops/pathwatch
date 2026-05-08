# Pathwatch Threat Assessment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `threat_assessments` table + slim banner UI + Polymarket comparison + trigger watchlist so the user can track outbreak threat level off DB+market signals instead of relying on media.

**Architecture:** One snapshot row per pipeline cycle in a denormalized `threat_assessments` table; latest row drives the UI. Banner strip under TopBar shows pandemic % + threat-level chip + Polymarket delta + expand chevron. Click expands a panel with reasoning, signal pills, trigger list, and market breakdown. Triggers + escalation rules are config (`lib/threat-triggers.ts`), not seed data. AI-vs-market delta is computed on read. Polymarket fetch is pipeline-side (Cowork-driven), not in-app.

**Tech Stack:** Supabase Postgres + Realtime + RLS, Next.js 14 App Router (RSC + client components), Tailwind v3 with intel-terminal palette tokens, pgTAP for DB tests, Playwright for smoke tests, Polymarket Gamma API (public, no auth).

---

### Task 0: Branch + verify Polymarket markets exist

**Files:** none

- [ ] **Step 1: Create the feature branch**

```bash
cd /Users/claude/Projects/project_contagion
git checkout main && git pull
git checkout -b feat/threat-assessment
```

- [ ] **Step 2: Hit the Polymarket Gamma API for all four slugs**

Run from a terminal:
```bash
for slug in hantavirus-pandemic-in-2026 confirmed-case-of-hantavirus-in-us-by-may-15 hantavirus-vaccine-in-2026 hantavirus-lab-leak-confirmed-by-june-30-1; do
  echo "=== $slug ==="
  curl -s "https://gamma-api.polymarket.com/events?slug=$slug" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("FOUND" if d else "MISSING"); 
[print(f"  market: {m.get(\"slug\")} tokens: {[(t.get(\"outcome\"), t.get(\"price\")) for t in m.get(\"tokens\", [])]}") for e in d for m in e.get("markets", [])] if d else None'
done
```

Expected: each slug returns at least one event with markets containing a `Yes` token and a numeric price.
If a slug returns `[]`/MISSING, note which one(s) — Task 5 will skip those columns in the UI but the schema field stays nullable.

- [ ] **Step 3: Commit nothing — this is a verification step. Move on if at least 2 of 4 markets resolve.**

If 0 of 4 resolve, STOP and ask: do we delay until they exist, or build behind a feature flag?

---

### Task 1: `threat_assessments` schema migration (TDD with pgTAP)

**Files:**
- Create: `supabase/tests/database/threat_assessments.test.sql`
- Create: `supabase/migrations/20260508130000_threat_assessments_schema.sql`

- [ ] **Step 1: Write the failing pgTAP test**

```sql
-- supabase/tests/database/threat_assessments.test.sql
BEGIN;
SELECT plan(18);

-- table exists
SELECT has_table('public', 'threat_assessments', 'threat_assessments table exists');

-- required columns
SELECT has_column('public', 'threat_assessments', 'id', 'has id');
SELECT has_column('public', 'threat_assessments', 'created_at', 'has created_at');
SELECT has_column('public', 'threat_assessments', 'disease', 'has disease');
SELECT has_column('public', 'threat_assessments', 'model', 'has model');
SELECT has_column('public', 'threat_assessments', 'pipeline_session_id', 'has pipeline_session_id');
SELECT has_column('public', 'threat_assessments', 'pandemic_probability', 'has pandemic_probability');
SELECT has_column('public', 'threat_assessments', 'threat_level', 'has threat_level');
SELECT has_column('public', 'threat_assessments', 'summary', 'has summary');
SELECT has_column('public', 'threat_assessments', 'reasoning', 'has reasoning');
SELECT has_column('public', 'threat_assessments', 'triggers_watching', 'has triggers_watching');
SELECT has_column('public', 'threat_assessments', 'triggers_tripped', 'has triggers_tripped');

-- check constraints
SELECT col_has_check('public', 'threat_assessments', 'pandemic_probability', 'pandemic_probability has CHECK');
SELECT col_has_check('public', 'threat_assessments', 'threat_level', 'threat_level has CHECK');

-- threat_level CHECK rejects bad value
PREPARE bad_level AS INSERT INTO threat_assessments (model, pandemic_probability, threat_level, summary, reasoning)
  VALUES ('test', 0.5, 'bogus', 's', 'r');
SELECT throws_ok('bad_level', '23514', NULL, 'rejects unknown threat_level');

-- pandemic_probability CHECK rejects out-of-range
PREPARE bad_prob AS INSERT INTO threat_assessments (model, pandemic_probability, threat_level, summary, reasoning)
  VALUES ('test', 1.5, 'low', 's', 'r');
SELECT throws_ok('bad_prob', '23514', NULL, 'rejects pandemic_probability > 1');

-- RLS enabled
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'threat_assessments'),
  true,
  'RLS enabled on threat_assessments'
);

-- public read policy exists
SELECT policies_are('public', 'threat_assessments', ARRAY['threat_public_read'], 'public read policy in place');

-- realtime publication includes threat_assessments
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'threat_assessments'
  ),
  'threat_assessments is in supabase_realtime publication'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run pgTAP — expect failure (table doesn't exist yet)**

```bash
supabase test db
```

Expected: `threat_assessments.test.sql` fails because the table doesn't exist.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260508130000_threat_assessments_schema.sql
CREATE TABLE threat_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  disease TEXT DEFAULT 'hantavirus' NOT NULL,

  model TEXT NOT NULL,
  pipeline_session_id TEXT,

  pandemic_probability DOUBLE PRECISION NOT NULL CHECK (pandemic_probability BETWEEN 0 AND 1),
  threat_level TEXT NOT NULL CHECK (threat_level IN ('minimal','low','moderate','elevated','high','critical')),
  summary TEXT NOT NULL,
  reasoning TEXT NOT NULL,

  r0_estimate DOUBLE PRECISION,
  r0_assessment TEXT,
  mutation_status TEXT CHECK (mutation_status IN ('none_detected','monitoring','concerning','critical')),
  mutation_notes TEXT,
  secondary_attack_rate DOUBLE PRECISION,
  secondary_attack_notes TEXT,
  case_doubling_days DOUBLE PRECISION,
  containment_effectiveness TEXT CHECK (containment_effectiveness IN ('effective','partially_effective','failing','unknown')),

  polymarket_pandemic_odds DOUBLE PRECISION,
  polymarket_us_case_odds DOUBLE PRECISION,
  polymarket_vaccine_odds DOUBLE PRECISION,
  polymarket_lab_leak_odds DOUBLE PRECISION,
  polymarket_fetched_at TIMESTAMPTZ,
  ai_vs_market_note TEXT,

  triggers_watching TEXT[] NOT NULL DEFAULT '{}',
  triggers_tripped TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_threat_created ON threat_assessments (created_at DESC);
CREATE INDEX idx_threat_disease ON threat_assessments (disease);

ALTER TABLE threat_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY threat_public_read ON threat_assessments FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE threat_assessments;
```

- [ ] **Step 4: Reset DB and re-run pgTAP**

```bash
./scripts/reset-db.sh
supabase test db
```

Expected: `threat_assessments.test.sql` passes 18/18.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260508130000_threat_assessments_schema.sql supabase/tests/database/threat_assessments.test.sql
git commit -m "Add threat_assessments table with RLS + Realtime (TDD)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: First-row seed (`seed-threat.sql`)

**Files:**
- Create: `supabase/seed-threat.sql`
- Modify: `supabase/config.toml:65`

- [ ] **Step 1: Write the seed**

```sql
-- supabase/seed-threat.sql
INSERT INTO threat_assessments (
  disease, model, pipeline_session_id,
  pandemic_probability, threat_level, summary, reasoning,
  r0_estimate, r0_assessment,
  mutation_status, mutation_notes,
  secondary_attack_rate, secondary_attack_notes,
  case_doubling_days, containment_effectiveness,
  polymarket_pandemic_odds, polymarket_us_case_odds, polymarket_vaccine_odds, polymarket_lab_leak_odds,
  polymarket_fetched_at, ai_vs_market_note,
  triggers_watching, triggers_tripped
) VALUES (
  'hantavirus',
  'claude-opus-4-7',
  'seed',
  0.035,
  'low',
  'Contained cruise ship cluster with R0 below 1. Person-to-person transmission confirmed but requires prolonged close contact. No evidence of airborne spread. No concerning mutations. Probability of pandemic: very low.',
  'Based on 9 cases (6 confirmed, 3 suspected) and 3 deaths across a single cruise ship cluster with limited secondary spread (1 confirmed non-ship case in Switzerland). Key factors keeping probability low: (1) R0 < 1 means chains burn out without sustained contact, (2) KL592 flight attendant negative result confirms brief contact insufficient, (3) no mutations in sequenced isolates, (4) WHO/CDC/ECDC all assess risk as LOW, (5) historical ANDV outbreaks (El Bolson 1996: 18 cases, Epuyen 2018: 36 cases) all self-limited. The 42-day surveillance window for ~600 passengers across 23 nationalities creates uncertainty — new cases may emerge — but the transmission biology constrains spread. Polymarket pandemic odds at 9% reflect media-driven fear premium over epidemiological reality.',
  0.7,
  'Below 1. Estimated from MV Hondius data: ~9 cases from ~150 people in prolonged close-quarters exposure over 3+ weeks. Secondary attack rate in household contacts (CH-001) is 1/2 (partner infected, wife not).',
  'none_detected',
  'Preliminary sequencing shows no atypical mutations vs reference Patagonian ANDV strain. Sequence identity between MVH-001 and MVH-002 confirms no inter-host mutation.',
  0.02,
  '1 confirmed secondary case (CH-001) out of hundreds of contacts traced across 12+ countries. KL592 flight attendant negative. Very low.',
  NULL,
  'effective',
  0.0905, 0.285, 0.115, 0.028,
  now(),
  'Our assessment (3.5%) is 5.5 percentage points below Polymarket consensus (9.05%). The delta likely reflects media-driven fear premium. Market participants may be overweighting the novel cruise-ship vector and underweighting the R0 < 1 constraint and KL592 negative result.',
  ARRAY[
    'airborne_transmission',
    'r0_above_one',
    'doubling_48h',
    'spike_mutation',
    'no_known_exposure',
    'who_above_low',
    'cdc_above_level3',
    'community_transmission'
  ],
  ARRAY[]::TEXT[]
);
```

- [ ] **Step 2: Register the seed in `supabase/config.toml`**

In `supabase/config.toml:65`, change:
```
sql_paths = ["./seed.sql", "./seed-facts.sql"]
```
to:
```
sql_paths = ["./seed.sql", "./seed-facts.sql", "./seed-threat.sql"]
```

- [ ] **Step 3: Reset DB and verify the seed loads**

```bash
./scripts/reset-db.sh
psql postgresql://postgres:postgres@localhost:54322/postgres -c "SELECT count(*), threat_level FROM threat_assessments GROUP BY threat_level;"
```

Expected: `1 | low`.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed-threat.sql supabase/config.toml
git commit -m "Seed v1 threat assessment baseline (3.5% / low)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Triggers config + types

**Files:**
- Create: `lib/threat-triggers.ts`
- Modify: `lib/types.ts` (add `ThreatAssessment`, `ThreatLevel`, `MutationStatus`, `ContainmentEffectiveness`)

- [ ] **Step 1: Add types to `lib/types.ts`**

Append:
```ts
export type ThreatLevel = 'minimal' | 'low' | 'moderate' | 'elevated' | 'high' | 'critical';
export type MutationStatus = 'none_detected' | 'monitoring' | 'concerning' | 'critical';
export type ContainmentEffectiveness = 'effective' | 'partially_effective' | 'failing' | 'unknown';

export interface ThreatAssessment {
  id: string;
  created_at: string;
  disease: string;
  model: string;
  pipeline_session_id: string | null;
  pandemic_probability: number;
  threat_level: ThreatLevel;
  summary: string;
  reasoning: string;
  r0_estimate: number | null;
  r0_assessment: string | null;
  mutation_status: MutationStatus | null;
  mutation_notes: string | null;
  secondary_attack_rate: number | null;
  secondary_attack_notes: string | null;
  case_doubling_days: number | null;
  containment_effectiveness: ContainmentEffectiveness | null;
  polymarket_pandemic_odds: number | null;
  polymarket_us_case_odds: number | null;
  polymarket_vaccine_odds: number | null;
  polymarket_lab_leak_odds: number | null;
  polymarket_fetched_at: string | null;
  ai_vs_market_note: string | null;
  triggers_watching: string[];
  triggers_tripped: string[];
}
```

- [ ] **Step 2: Write `lib/threat-triggers.ts`**

```ts
import type { ThreatLevel } from './types';

export interface TriggerDef {
  id: string;
  label: string;
  escalateTo: ThreatLevel;
}

export const TRIGGERS: readonly TriggerDef[] = [
  { id: 'airborne_transmission',  label: 'Confirmed airborne transmission case',           escalateTo: 'elevated' },
  { id: 'r0_above_one',           label: 'R0 estimate crosses above 1.0',                  escalateTo: 'elevated' },
  { id: 'doubling_48h',           label: 'Case count doubles within 48 hours',             escalateTo: 'moderate' },
  { id: 'spike_mutation',         label: 'New ANDV strain with Gn/Gc spike mutations',     escalateTo: 'moderate' },
  { id: 'no_known_exposure',      label: 'Case with NO close/prolonged exposure history',  escalateTo: 'moderate' },
  { id: 'who_above_low',          label: 'WHO raises risk assessment above LOW',           escalateTo: 'moderate' },
  { id: 'cdc_above_level3',       label: 'CDC raises above Level 3',                       escalateTo: 'moderate' },
  { id: 'community_transmission', label: 'Community transmission outside index contacts', escalateTo: 'elevated' },
  { id: 'twenty_countries',       label: 'Cases in 20+ countries',                         escalateTo: 'low' },
] as const;

export const TRIGGER_BY_ID: Record<string, TriggerDef> = Object.fromEntries(
  TRIGGERS.map((t) => [t.id, t]),
);

export const THREAT_LEVEL_TOKEN: Record<ThreatLevel, { label: string; cls: string; dotCls: string }> = {
  minimal:  { label: 'MINIMAL',  cls: 'text-green border-green',                 dotCls: 'bg-green' },
  low:      { label: 'LOW',      cls: 'text-text-secondary border-text-secondary', dotCls: 'bg-text-secondary' },
  moderate: { label: 'MODERATE', cls: 'text-confirmed border-confirmed',         dotCls: 'bg-confirmed' },
  elevated: { label: 'ELEVATED', cls: 'text-critical border-critical',           dotCls: 'bg-critical' },
  high:     { label: 'HIGH',     cls: 'text-deceased border-deceased',           dotCls: 'bg-deceased' },
  critical: { label: 'CRITICAL', cls: 'text-deceased border-deceased bg-[#1a0a0d]', dotCls: 'bg-deceased' },
};
```

(Tailwind tokens `green`, `confirmed`, `critical`, `deceased`, `text-secondary` are already defined in `tailwind.config.ts` per the existing palette — no new additions.)

- [ ] **Step 3: Verify tokens exist**

```bash
grep -E "confirmed|critical|deceased|text-secondary|green:" tailwind.config.ts
```

Expected: all five appear. If any are missing, add them in this step rather than introducing untokened hex.

- [ ] **Step 4: typecheck + lint**

```bash
npm run typecheck
node_modules/.bin/eslint lib/threat-triggers.ts lib/types.ts
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add lib/threat-triggers.ts lib/types.ts
git commit -m "Add threat-triggers config + ThreatAssessment types

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Server-side data fetch helper

**Files:**
- Create: `lib/threat-data.ts`

- [ ] **Step 1: Write the fetch helper**

```ts
// lib/threat-data.ts
import { createClient } from '@supabase/supabase-js';
import type { ThreatAssessment } from './types';

export async function getLatestThreatAssessment(): Promise<ThreatAssessment | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from('threat_assessments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('threat fetch error', error);
    return null;
  }
  return data as ThreatAssessment | null;
}
```

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/threat-data.ts
git commit -m "Add getLatestThreatAssessment server helper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: ThreatBanner + ProbabilityMeter + PolymarketComparison

**Files:**
- Create: `components/threat/ThreatBanner.tsx`
- Create: `components/threat/ProbabilityMeter.tsx`
- Create: `components/threat/PolymarketComparison.tsx`

- [ ] **Step 1: Write `ProbabilityMeter.tsx`**

```tsx
import type { ThreatAssessment } from '@/lib/types';
import { THREAT_LEVEL_TOKEN } from '@/lib/threat-triggers';

export function ProbabilityMeter({ assessment }: { assessment: ThreatAssessment }) {
  const t = THREAT_LEVEL_TOKEN[assessment.threat_level];
  const pct = (assessment.pandemic_probability * 100).toFixed(1);
  return (
    <div className="flex items-center gap-3">
      <span className={`inline-block h-2 w-2 rounded-full ${t.dotCls}`} />
      <span className={`border px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] ${t.cls}`}>
        {t.label}
      </span>
      <span className="font-mono text-[20px] font-semibold leading-none text-text">
        {pct}%
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
        PANDEMIC PROBABILITY
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Write `PolymarketComparison.tsx`**

```tsx
import type { ThreatAssessment } from '@/lib/types';

export function PolymarketComparison({ assessment }: { assessment: ThreatAssessment }) {
  const ai = assessment.pandemic_probability;
  const market = assessment.polymarket_pandemic_odds;
  if (market == null) return null;
  const delta = ai - market;
  const dir = delta < 0 ? 'BELOW' : delta > 0 ? 'ABOVE' : 'EVEN';
  const cls =
    delta < -0.005 ? 'text-green border-green' :
    delta >  0.005 ? 'text-deceased border-deceased' :
                     'text-text-secondary border-text-secondary';
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
      <span>vs MARKET</span>
      <span className="font-mono text-[12px] text-text">{(market * 100).toFixed(1)}%</span>
      <span className={`border px-1.5 py-0.5 ${cls}`}>
        Δ {(Math.abs(delta) * 100).toFixed(1)}% {dir}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Write `ThreatBanner.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ThreatAssessment } from '@/lib/types';
import { ProbabilityMeter } from './ProbabilityMeter';
import { PolymarketComparison } from './PolymarketComparison';
import { ThreatPanelExpanded } from './ThreatPanelExpanded';

export function ThreatBanner({ assessment }: { assessment: ThreatAssessment }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-6 px-4 py-2 hover:bg-surface-2"
        aria-expanded={open}
      >
        <ProbabilityMeter assessment={assessment} />
        <PolymarketComparison assessment={assessment} />
        <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
          {open ? 'COLLAPSE' : 'EXPAND'}
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>
      {open && <ThreatPanelExpanded assessment={assessment} />}
    </div>
  );
}
```

- [ ] **Step 4: typecheck + lint**

```bash
npm run typecheck
node_modules/.bin/eslint components/threat/
```

Note: `ThreatPanelExpanded` does not exist yet — TS will error. That's fine; Task 6 lands it.

- [ ] **Step 5: Commit (skip if typecheck fails — bundle with Task 6)**

We'll commit after Task 6 since these files reference each other.

---

### Task 6: ThreatPanelExpanded + SignalIndicators + TriggerWatchlist

**Files:**
- Create: `components/threat/ThreatPanelExpanded.tsx`
- Create: `components/threat/SignalIndicators.tsx`
- Create: `components/threat/TriggerWatchlist.tsx`

- [ ] **Step 1: Write `SignalIndicators.tsx`**

```tsx
import type { ThreatAssessment } from '@/lib/types';

interface Pill { label: string; value: string; cls: string; }

function pills(a: ThreatAssessment): Pill[] {
  const out: Pill[] = [];
  if (a.r0_estimate != null) {
    const ok = a.r0_estimate < 1;
    out.push({ label: 'R0', value: a.r0_estimate.toFixed(2), cls: ok ? 'text-green border-green' : 'text-deceased border-deceased' });
  }
  if (a.mutation_status) {
    const cls = a.mutation_status === 'none_detected' ? 'text-green border-green'
              : a.mutation_status === 'monitoring'    ? 'text-confirmed border-confirmed'
              : a.mutation_status === 'concerning'    ? 'text-critical border-critical'
              :                                         'text-deceased border-deceased';
    out.push({ label: 'MUTATIONS', value: a.mutation_status.replace('_',' ').toUpperCase(), cls });
  }
  if (a.secondary_attack_rate != null) {
    const ok = a.secondary_attack_rate < 0.05;
    out.push({ label: 'SAR', value: `${(a.secondary_attack_rate * 100).toFixed(1)}%`, cls: ok ? 'text-green border-green' : 'text-deceased border-deceased' });
  }
  if (a.containment_effectiveness) {
    const cls = a.containment_effectiveness === 'effective'           ? 'text-green border-green'
              : a.containment_effectiveness === 'partially_effective' ? 'text-confirmed border-confirmed'
              : a.containment_effectiveness === 'failing'             ? 'text-deceased border-deceased'
              :                                                          'text-text-secondary border-text-secondary';
    out.push({ label: 'CONTAINMENT', value: a.containment_effectiveness.replace('_',' ').toUpperCase(), cls });
  }
  if (a.case_doubling_days != null) {
    out.push({ label: 'DOUBLING', value: `${a.case_doubling_days.toFixed(1)}d`, cls: 'text-confirmed border-confirmed' });
  }
  return out;
}

export function SignalIndicators({ assessment }: { assessment: ThreatAssessment }) {
  return (
    <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.14em]">
      {pills(assessment).map((p) => (
        <span key={p.label} className={`border px-2 py-0.5 ${p.cls}`}>
          <span className="text-text-muted">{p.label}</span>{' '}<span>{p.value}</span>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write `TriggerWatchlist.tsx`**

```tsx
import type { ThreatAssessment } from '@/lib/types';
import { TRIGGER_BY_ID } from '@/lib/threat-triggers';

export function TriggerWatchlist({ assessment }: { assessment: ThreatAssessment }) {
  const tripped = new Set(assessment.triggers_tripped);
  const ids = [...new Set([...assessment.triggers_watching, ...assessment.triggers_tripped])];
  return (
    <ul className="grid grid-cols-1 gap-1 md:grid-cols-2">
      {ids.map((id) => {
        const def = TRIGGER_BY_ID[id];
        if (!def) return null;
        const isTripped = tripped.has(id);
        const cls = isTripped ? 'border-deceased text-deceased' : 'border-border text-text-secondary';
        const status = isTripped ? 'TRIPPED' : 'WATCHING';
        return (
          <li key={id} className={`border px-2 py-1.5 font-mono text-[11px] ${cls}`}>
            <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted">{status} · </span>
            {def.label}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 3: Write `ThreatPanelExpanded.tsx`**

```tsx
import type { ThreatAssessment } from '@/lib/types';
import { SignalIndicators } from './SignalIndicators';
import { TriggerWatchlist } from './TriggerWatchlist';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';

function pct(v: number | null) { return v == null ? '—' : `${(v * 100).toFixed(1)}%`; }

export function ThreatPanelExpanded({ assessment: a }: { assessment: ThreatAssessment }) {
  const age = formatDistanceToNowStrict(parseISO(a.created_at)).toUpperCase();
  return (
    <div className="grid gap-4 border-t border-border bg-bg px-4 py-4 md:grid-cols-3">
      <div className="md:col-span-2 space-y-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
          ASSESSMENT · <span suppressHydrationWarning>{age} AGO</span> · MODEL {a.model}
        </div>
        <p className="text-[13px] leading-snug text-text">{a.summary}</p>
        <p className="text-[12px] leading-relaxed text-text-secondary">{a.reasoning}</p>
        <SignalIndicators assessment={a} />
      </div>
      <div className="space-y-3">
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">POLYMARKET</div>
          <dl className="grid grid-cols-[1fr_auto] gap-y-0.5 font-mono text-[11px]">
            <dt className="text-text-muted">Pandemic 2026</dt><dd className="text-right text-text">{pct(a.polymarket_pandemic_odds)}</dd>
            <dt className="text-text-muted">US case by May 15</dt><dd className="text-right text-text">{pct(a.polymarket_us_case_odds)}</dd>
            <dt className="text-text-muted">Vaccine 2026</dt><dd className="text-right text-text">{pct(a.polymarket_vaccine_odds)}</dd>
            <dt className="text-text-muted">Lab leak by Jun 30</dt><dd className="text-right text-text">{pct(a.polymarket_lab_leak_odds)}</dd>
          </dl>
          {a.ai_vs_market_note && (
            <p className="mt-2 text-[11px] leading-snug text-text-secondary">{a.ai_vs_market_note}</p>
          )}
        </div>
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">TRIGGERS</div>
          <TriggerWatchlist assessment={a} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: typecheck + lint**

```bash
npm run typecheck
node_modules/.bin/eslint components/threat/
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add components/threat/
git commit -m "Add ThreatBanner + expanded panel (probability + signals + triggers + market)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Wire banner into the dashboard

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Read the current `app/page.tsx` to find the right insertion point**

Use Read tool. Locate where the page renders TopBar followed by DashboardClient. The banner goes between them.

- [ ] **Step 2: Add the fetch + render**

In the page's RSC handler, fetch the latest assessment in parallel with the existing data, then render:

```tsx
import { getLatestThreatAssessment } from '@/lib/threat-data';
import { ThreatBanner } from '@/components/threat/ThreatBanner';

// inside the page component:
const [/*existing*/, threat] = await Promise.all([
  /* existing fetches */,
  getLatestThreatAssessment(),
]);

// in the JSX, between TopBar and DashboardClient:
{threat && <ThreatBanner assessment={threat} />}
```

(Adapt to the actual existing fetch shape — replace placeholders with real names.)

- [ ] **Step 3: Start dev, verify visually**

```bash
(lsof -ti :3000 | xargs kill -9 2>/dev/null || true)
npm run dev > /tmp/dev.log 2>&1 &
until grep -q "Ready in" /tmp/dev.log; do sleep 0.5; done
curl -s http://localhost:3000/ | grep -c "PANDEMIC PROBABILITY"
```

Expected: `1` (the banner rendered server-side).

- [ ] **Step 4: typecheck + build**

```bash
npm run typecheck
npm run build
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "Mount ThreatBanner under TopBar on dashboard

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Smoke test

**Files:**
- Modify: `tests/dashboard.spec.ts`

- [ ] **Step 1: Append a new spec**

```ts
test('threat banner renders + expands', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('PANDEMIC PROBABILITY')).toBeVisible();
  await expect(page.getByText('LOW')).toBeVisible();
  await expect(page.getByText(/vs MARKET/i)).toBeVisible();
  await page.getByRole('button', { name: /EXPAND/i }).click();
  await expect(page.getByText('TRIGGERS')).toBeVisible();
  await expect(page.getByText(/WATCHING · /)).toBeVisible();
});
```

- [ ] **Step 2: Run the full smoke suite**

```bash
npm run test:smoke
```

Expected: 8 passed (7 existing + new).

- [ ] **Step 3: Commit**

```bash
git add tests/dashboard.spec.ts
git commit -m "Smoke: threat banner renders and expands

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Apply migration to remote Supabase + deploy

**Files:** none

- [ ] **Step 1: Push migration to remote**

```bash
supabase db push --linked
```

Expected: applies `20260508130000_threat_assessments_schema.sql` to `wtatysorlkcteleqjzkm.supabase.co`.

- [ ] **Step 2: Insert seed row into remote**

```bash
psql "$(grep SUPABASE_DB_URL .env.production | cut -d= -f2-)" -f supabase/seed-threat.sql
```

If `SUPABASE_DB_URL` isn't in `.env.production`, derive the connection string from the Supabase dashboard and run manually. Verify:

```bash
psql "$..." -c "SELECT created_at, threat_level, pandemic_probability FROM threat_assessments ORDER BY created_at DESC LIMIT 1;"
```

Expected: one row, `low`, `0.035`.

- [ ] **Step 3: Merge to main + push for Vercel auto-deploy**

```bash
git checkout main && git pull
git merge --no-ff feat/threat-assessment -m "Merge feat/threat-assessment: threat panel + Polymarket comparison"
git push origin main
```

- [ ] **Step 4: Wait for Vercel deploy READY then verify production**

```bash
vercel ls | head -3
# wait until top deployment is Ready
curl -s https://pathwatch-phi.vercel.app | grep -c "PANDEMIC PROBABILITY"
```

Expected: `1`.

- [ ] **Step 5: Cleanup branch**

```bash
git branch -d feat/threat-assessment
```

---

### Task 10: Update pipeline runbook

**Files:**
- Modify: `docs/runbooks/pipeline.md`

- [ ] **Step 1: Add a "Threat assessment" section to the runbook**

Document the cycle:
1. Fetch all 4 Polymarket markets via `gamma-api.polymarket.com/events?slug=…` and extract YES prices.
2. Re-evaluate triggers against new cases / events / facts since last assessment.
3. Compose the new assessment (probability, threat_level, summary, reasoning, signals, triggers_watching/tripped).
4. Insert a new row into `threat_assessments` ONLY if `|new - last| > 0.01` OR a trigger trips/clears. Otherwise skip.
5. Always set `model` to the running model id and `pipeline_session_id` to the Cowork session id.

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/pipeline.md
git commit -m "Runbook: document threat-assessment cycle

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

## Self-review

- **Spec coverage:** schema (Task 1) ✅, seed (Task 2) ✅, triggers config (Task 3) ✅, types (Task 3) ✅, server fetch (Task 4) ✅, banner UI (Task 5) ✅, expanded panel + sub-components (Task 6) ✅, dashboard wire-up (Task 7) ✅, smoke (Task 8) ✅, remote deploy (Task 9) ✅, runbook (Task 10) ✅. Polymarket verification (Task 0) ✅.
- **No placeholders:** every code block is concrete; the only "adapt to existing fetch shape" line is in Task 7 Step 2 and is a deliberate hand-off because the page's exact RSC fetch shape varies.
- **Type consistency:** `ThreatAssessment` shape from Task 3 is used unchanged in Tasks 4–8. Trigger ids in Task 3 match the seed array in Task 2.
- **Defer-list:** historical sparkline, write RLS, `/threat` permalink — all explicitly out of scope.
