# Pathwatch Pipeline API Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dispatch-session pipeline with a Vercel Function that calls the Anthropic API directly, runs every 6 hours, and writes to all existing Pathwatch Supabase tables.

**Architecture:** Single Vercel Function at `app/api/cron/pipeline/route.ts`. Two AI phases (Sonnet 4.6 agent loop + Opus 4.7 1M structured output), one logging phase. Tools are typed AI SDK tools backed by Supabase. Idempotent writes throughout.

**Tech Stack:** Next.js 14 App Router · Vercel Functions (Fluid Compute) · Vercel Cron · AI SDK (`ai`) · `@ai-sdk/anthropic` (needed for `web_search_20250305` server tool) · Zod · Supabase (service-role for writes) · Vitest (new) for unit tests · existing Playwright e2e

**Reference spec:** `docs/superpowers/specs/2026-05-09-pipeline-api-rebuild-design.md`

---

## Pre-flight expectations

- Local Supabase running via Colima/Docker (`npm run db:reset` works)
- `.env.local` populated with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- You will add: `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`
- The dispatch session is already disabled (`scheduled-tasks.json` → `enabled: false`); no coordination needed for cutover
- Use `pnpm` if the repo has a lockfile for it; otherwise `npm` per existing `package-lock.json`

---

## File structure

Files this plan creates or modifies (each with single responsibility):

```
NEW   app/api/cron/pipeline/route.ts           HTTP boundary, auth, dispatch
NEW   lib/supabase-admin.ts                    Service-role Supabase client
NEW   lib/pipeline/index.ts                    Orchestrator (runPipeline)
NEW   lib/pipeline/auth.ts                     verifyCronSecret(request)
NEW   lib/pipeline/types.ts                    Zod schemas + TS types
NEW   lib/pipeline/phase1-scrape.ts            Sonnet agent loop
NEW   lib/pipeline/phase2-analyze.ts           Opus structured output + writes
NEW   lib/pipeline/phase3-log.ts               scrape_log writer
NEW   lib/pipeline/polymarket.ts               Non-AI Polymarket fetch
NEW   lib/pipeline/tools/index.ts              Tool registry export
NEW   lib/pipeline/tools/web-fetch.ts          Plain HTTP fetch with caps
NEW   lib/pipeline/tools/events.ts             read/write event tools
NEW   lib/pipeline/tools/cases.ts              read/write case + case_location tools
NEW   lib/pipeline/tools/relationships.ts      write case_relationship tool
NEW   lib/pipeline/tools/country-stats.ts      sync country_stats tool
NEW   lib/pipeline/tools/facts.ts              read/write fact tools
NEW   lib/pipeline/prompts/phase1-system.md    Sonnet agent system prompt
NEW   lib/pipeline/prompts/phase2-system.md    Opus analyzer system prompt
NEW   lib/pipeline/__tests__/<each>.test.ts    Vitest unit tests per tool
NEW   supabase/migrations/20260509120000_case_locations_transit.sql
NEW   supabase/migrations/20260509130000_case_relationships.sql
NEW   supabase/migrations/20260509140000_scrape_log_metrics.sql
NEW   supabase/migrations/20260509150000_case_locations_unique.sql
NEW   scripts/pipeline-smoke.ts                Manual smoke run
NEW   vitest.config.ts                         Vitest configuration
MOD   .env.example                             Add new env vars
MOD   package.json                             Add deps + scripts
MOD   vercel.json                              Add crons entry
```

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install ai @ai-sdk/anthropic zod
```

Expected: packages added to `dependencies`. The plan uses `@ai-sdk/anthropic` directly (not via Vercel AI Gateway) because the pipeline depends on Anthropic's `web_search_20250305` server tool, which is exposed via the Anthropic provider package.

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D vitest @vitest/ui
```

- [ ] **Step 3: Verify installs**

Run: `npm ls ai @ai-sdk/anthropic zod vitest`
Expected: each package shows a version, no missing peer deps.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install AI SDK, Anthropic provider, Zod, Vitest for pipeline rebuild"
```

---

## Task 2: Configure Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Create vitest config**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts'],
    exclude: ['node_modules', 'tests', '.next'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 2: Add test scripts to package.json**

Modify the `"scripts"` block in `package.json` to add:

```json
"test:unit": "vitest run",
"test:unit:watch": "vitest"
```

- [ ] **Step 3: Verify config works**

Run: `npm run test:unit`
Expected: "No test files found" (no tests yet) — but vitest itself executes without error.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts package.json
git commit -m "chore: configure Vitest for pipeline unit tests"
```

---

## Task 3: Update .env.example with new variables

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Append new vars**

Replace `.env.example` content with:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-with-output-of-supabase-status

# Service-role key — REQUIRED for pipeline writes. Never expose to browser.
# Local: from `supabase status` output. Production: from Supabase dashboard.
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic API key — REQUIRED for pipeline AI calls.
# Get from https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=

# Shared secret used by Vercel Cron to authenticate /api/cron/pipeline.
# Generate with: openssl rand -hex 32
CRON_SECRET=
```

- [ ] **Step 2: Confirm `.env.local` has the actual values populated**

Run: `grep -E '^(SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY|CRON_SECRET)=' .env.local || echo "missing"`
If "missing" appears, populate them in `.env.local` (not in `.env.example`).

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: document SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, CRON_SECRET"
```

---

## Task 4: Migration A — case_locations transit fields

**Files:**
- Create: `supabase/migrations/20260509120000_case_locations_transit.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260509120000_case_locations_transit.sql
-- Add structured transit metadata so Palantir-style traces can label flights
-- and queries can find shared-flight clusters.

ALTER TABLE case_locations
  ADD COLUMN transit_mode TEXT
    CHECK (transit_mode IN ('flight','ship','land','unknown')),
  ADD COLUMN transit_id TEXT,
  ADD COLUMN transit_origin_code TEXT,
  ADD COLUMN transit_destination_code TEXT;

CREATE INDEX idx_case_locations_transit
  ON case_locations (transit_id)
  WHERE transit_id IS NOT NULL;
```

- [ ] **Step 2: Apply via db:reset**

Run: `npm run db:reset`
Expected: completes cleanly, no errors.

- [ ] **Step 3: Verify columns exist**

Run:

```bash
supabase db query "SELECT column_name FROM information_schema.columns WHERE table_name='case_locations' AND column_name LIKE 'transit_%' ORDER BY column_name;" --local
```

Expected: 4 rows: `transit_destination_code`, `transit_id`, `transit_mode`, `transit_origin_code`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260509120000_case_locations_transit.sql
git commit -m "feat(db): add transit metadata columns to case_locations"
```

---

## Task 5: Migration B — case_relationships table

**Files:**
- Create: `supabase/migrations/20260509130000_case_relationships.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260509130000_case_relationships.sql
-- Transmission graph: edges between cases for R0 calculation,
-- contact-tracing depth, cluster visualization.

CREATE TABLE case_relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  disease TEXT DEFAULT 'hantavirus' NOT NULL,
  source_case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  target_case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL
    CHECK (relationship_type IN ('infected_by','co_exposed','contact')),
  confidence DOUBLE PRECISION CHECK (confidence BETWEEN 0 AND 1),
  evidence_event_id UUID REFERENCES events(id),
  notes TEXT,
  CHECK (source_case_id <> target_case_id),
  UNIQUE (source_case_id, target_case_id, relationship_type)
);

CREATE INDEX idx_case_rel_target ON case_relationships (target_case_id);
CREATE INDEX idx_case_rel_source ON case_relationships (source_case_id);
CREATE INDEX idx_case_rel_disease ON case_relationships (disease);

ALTER TABLE case_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY case_relationships_public_read
  ON case_relationships FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE case_relationships;
```

- [ ] **Step 2: Apply via db:reset**

Run: `npm run db:reset`
Expected: clean run.

- [ ] **Step 3: Verify table exists with RLS + realtime**

Run:

```bash
supabase db query "SELECT relname, relrowsecurity FROM pg_class WHERE relname='case_relationships';" --local
```

Expected: one row with `relrowsecurity=t`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260509130000_case_relationships.sql
git commit -m "feat(db): add case_relationships transmission graph"
```

---

## Task 6: Migration C — scrape_log metrics columns

**Files:**
- Create: `supabase/migrations/20260509140000_scrape_log_metrics.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260509140000_scrape_log_metrics.sql
-- Extend scrape_log so it actually answers "did this cycle succeed,
-- what did it write, what did it cost?"

ALTER TABLE scrape_log
  ADD COLUMN cases_created INTEGER DEFAULT 0,
  ADD COLUMN facts_created INTEGER DEFAULT 0,
  ADD COLUMN relationships_created INTEGER DEFAULT 0,
  ADD COLUMN threat_written BOOLEAN DEFAULT false,
  ADD COLUMN snapshot_written BOOLEAN DEFAULT false,
  ADD COLUMN error_phase TEXT
    CHECK (error_phase IN ('scrape','analyze','log')),
  ADD COLUMN total_cost_usd DOUBLE PRECISION;
```

- [ ] **Step 2: Apply and verify**

Run: `npm run db:reset`

Run:

```bash
supabase db query "SELECT column_name FROM information_schema.columns WHERE table_name='scrape_log' ORDER BY ordinal_position;" --local
```

Expected: includes the 7 new columns.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260509140000_scrape_log_metrics.sql
git commit -m "feat(db): extend scrape_log with cycle metrics columns"
```

---

## Task 7: Migration D — case_locations idempotency constraint

**Files:**
- Create: `supabase/migrations/20260509150000_case_locations_unique.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260509150000_case_locations_unique.sql
-- Prevent duplicate stops if a cycle re-runs the same prompt.
-- transit_id participates so two real flights from the same origin
-- on the same day stay distinct.

ALTER TABLE case_locations
  ADD CONSTRAINT case_locations_unique_stop
  UNIQUE NULLS NOT DISTINCT (case_id, arrived_at, transit_id);
```

- [ ] **Step 2: Apply and verify**

Run: `npm run db:reset`

Run:

```bash
supabase db query "SELECT conname FROM pg_constraint WHERE conrelid='case_locations'::regclass AND contype='u';" --local
```

Expected: includes `case_locations_unique_stop`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260509150000_case_locations_unique.sql
git commit -m "feat(db): unique constraint on case_locations stops for idempotency"
```

---

## Task 8: Service-role Supabase client

**Files:**
- Create: `lib/supabase-admin.ts`

- [ ] **Step 1: Create the admin client**

```ts
// lib/supabase-admin.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
  return cached;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase-admin.ts
git commit -m "feat(pipeline): add service-role Supabase client for writes"
```

---

## Task 9: Pipeline types and Zod schemas

**Files:**
- Create: `lib/pipeline/types.ts`

- [ ] **Step 1: Create types file**

```ts
// lib/pipeline/types.ts
import { z } from 'zod';

export const SourceTypeEnum = z.enum([
  'x','cdc','who','google_news','reddit','bluesky','ecdc','africa_cdc','wikipedia',
]);
export type SourceType = z.infer<typeof SourceTypeEnum>;

export const EventCategoryEnum = z.enum([
  'case_report','policy','research','travel_advisory',
  'mutation','death','containment','speculation',
]);

export const CaseStatusEnum = z.enum([
  'monitoring','suspected','confirmed','recovered','deceased','critical',
]);

export const ThreatLevelEnum = z.enum([
  'minimal','low','moderate','elevated','high','critical',
]);

export const MutationStatusEnum = z.enum([
  'none_detected','monitoring','concerning','critical',
]);

export const ContainmentEffectivenessEnum = z.enum([
  'effective','partially_effective','failing','unknown',
]);

export const TrendEnum = z.enum(['accelerating','stable','declining']);
export const RiskLevelEnum = z.enum(['low','moderate','high','critical']);

// What Phase 1 returns to the orchestrator.
export const PipelineDeltaSchema = z.object({
  search_results_found: z.number().int().nonnegative(),
  events_created: z.number().int().nonnegative(),
  events_skipped_duplicates: z.number().int().nonnegative(),
  cases_created: z.number().int().nonnegative(),
  cases_updated: z.number().int().nonnegative(),
  case_locations_created: z.number().int().nonnegative(),
  relationships_created: z.number().int().nonnegative(),
  facts_created: z.number().int().nonnegative(),
  facts_updated: z.number().int().nonnegative(),
  country_stats_synced: z.number().int().nonnegative(),
  cost_usd: z.number().nonnegative(),
});
export type PipelineDelta = z.infer<typeof PipelineDeltaSchema>;

// What Phase 2 produces (structured output from Opus).
export const ThreatAssessmentOutputSchema = z.object({
  pandemic_probability: z.number().min(0).max(1),
  threat_level: ThreatLevelEnum,
  summary: z.string().min(1),
  reasoning: z.string().min(1),
  r0_estimate: z.number().nullable(),
  r0_assessment: z.string().nullable(),
  mutation_status: MutationStatusEnum,
  mutation_notes: z.string().nullable(),
  secondary_attack_rate: z.number().nullable(),
  secondary_attack_notes: z.string().nullable(),
  case_doubling_days: z.number().nullable(),
  containment_effectiveness: ContainmentEffectivenessEnum,
  ai_vs_market_note: z.string().nullable(),
  triggers_watching: z.array(z.string()),
  triggers_tripped: z.array(z.string()),
});
export type ThreatAssessmentOutput = z.infer<typeof ThreatAssessmentOutputSchema>;

export const SnapshotOutputSchema = z.object({
  total_cases: z.number().int().nonnegative(),
  total_deaths: z.number().int().nonnegative(),
  countries_affected: z.number().int().nonnegative(),
  countries_list: z.array(z.string()),
  fatality_rate: z.number().min(0).max(1),
  trend: TrendEnum,
  trend_description: z.string(),
  risk_level: RiskLevelEnum,
  key_developments: z.array(z.string()),
  ai_analysis: z.string(),
});
export type SnapshotOutput = z.infer<typeof SnapshotOutputSchema>;

// Phase 2 emits a threat assessment every cycle. Snapshot is null when there is
// no material change vs the most recent stored snapshot.
export const AnalysisOutputSchema = z.object({
  threat: ThreatAssessmentOutputSchema,
  snapshot: SnapshotOutputSchema.nullable(),
});
export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;

// Polymarket fetch shape.
export const PolymarketSnapshotSchema = z.object({
  pandemic: z.number().min(0).max(1).nullable(),
  us_case: z.number().min(0).max(1).nullable(),
  vaccine: z.number().min(0).max(1).nullable(),
  lab_leak: z.number().min(0).max(1).nullable(),
  fetched_at: z.string().datetime(),
});
export type PolymarketSnapshot = z.infer<typeof PolymarketSnapshotSchema>;

// Final pipeline result returned by runPipeline().
export interface PipelineResult {
  ok: boolean;
  cycle_id: string;
  duration_ms: number;
  delta: PipelineDelta;
  threat_written: boolean;
  snapshot_written: boolean;
  total_cost_usd: number;
  error?: string;
  error_phase?: 'scrape' | 'analyze' | 'log';
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/pipeline/types.ts
git commit -m "feat(pipeline): add Zod schemas + TS types for delta and analysis output"
```

---

## Task 10: web-fetch tool (with timeout + size cap)

**Files:**
- Create: `lib/pipeline/tools/web-fetch.ts`
- Test: `lib/pipeline/tools/web-fetch.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/pipeline/tools/web-fetch.test.ts
import { describe, it, expect } from 'vitest';
import { webFetchTool } from './web-fetch';

describe('webFetchTool', () => {
  it('fetches a small text body successfully', async () => {
    // Use a known-stable, small endpoint
    const result = await webFetchTool.execute(
      { url: 'https://example.com', max_bytes: 100_000 },
      { toolCallId: 't', messages: [] },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(200);
      expect(result.body.toLowerCase()).toContain('example domain');
    }
  });

  it('returns ok:false on a non-2xx status', async () => {
    const result = await webFetchTool.execute(
      { url: 'https://httpbin.org/status/404', max_bytes: 10_000 },
      { toolCallId: 't', messages: [] },
    );
    expect(result.ok).toBe(false);
  });

  it('rejects URLs that are not https', async () => {
    const result = await webFetchTool.execute(
      { url: 'file:///etc/hosts', max_bytes: 1000 },
      { toolCallId: 't', messages: [] },
    );
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm run test:unit -- web-fetch`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the tool**

```ts
// lib/pipeline/tools/web-fetch.ts
import { tool } from 'ai';
import { z } from 'zod';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 1_000_000;

export const webFetchTool = tool({
  description:
    'Fetch a public HTTPS URL and return its body as text. ' +
    'Use to read article content from a known URL. ' +
    'Returns ok:false on non-2xx, timeout, oversized response, or non-https URLs. ' +
    'Has a 15s timeout and 1MB body cap by default.',
  parameters: z.object({
    url: z.string().url(),
    max_bytes: z.number().int().min(1000).max(2_000_000).default(DEFAULT_MAX_BYTES),
    timeout_ms: z.number().int().min(1000).max(30_000).default(DEFAULT_TIMEOUT_MS),
  }),
  execute: async ({ url, max_bytes, timeout_ms }) => {
    if (!url.startsWith('https://')) {
      return { ok: false as const, error: 'only https URLs allowed' };
    }
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout_ms);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Pathwatch-Pipeline/1.0 (+https://pathwatch-phi.vercel.app)',
        },
        redirect: 'follow',
      });
      if (!res.ok) {
        return { ok: false as const, error: `http ${res.status}`, status: res.status };
      }
      const reader = res.body?.getReader();
      if (!reader) return { ok: false as const, error: 'no body' };
      const decoder = new TextDecoder();
      let total = 0;
      let body = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > max_bytes) {
          await reader.cancel();
          return { ok: false as const, error: 'response exceeded max_bytes' };
        }
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
      return {
        ok: true as const,
        status: res.status,
        url: res.url,
        body,
        bytes: total,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg };
    } finally {
      clearTimeout(t);
    }
  },
});
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm run test:unit -- web-fetch`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline/tools/web-fetch.ts lib/pipeline/tools/web-fetch.test.ts
git commit -m "feat(pipeline): web-fetch tool with timeout and size cap"
```

---

## Task 11: events tools (read recent + write)

**Files:**
- Create: `lib/pipeline/tools/events.ts`
- Test: `lib/pipeline/tools/events.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/pipeline/tools/events.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import { readRecentEventsTool, writeEventTool } from './events';
import { adminClient } from '@/lib/supabase-admin';

beforeEach(() => {
  // Wipe events table before each test (local dev DB only).
  execSync('supabase db query "DELETE FROM events;" --local', { stdio: 'ignore' });
});

const ctx = { toolCallId: 't', messages: [] as never[] };

describe('writeEventTool', () => {
  it('inserts a new event and returns its id', async () => {
    const result = await writeEventTool.execute({
      title: 'Test event',
      summary: 'A summary.',
      source_type: 'who',
      source_url: 'https://example.com/who-test',
      significance: 3,
      category: 'case_report',
      country_code: 'US',
      tags: ['test'],
    }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('returns ok:false with reason "duplicate" on URL collision', async () => {
    const args = {
      title: 'Dupe',
      summary: 's',
      source_type: 'who' as const,
      source_url: 'https://example.com/dupe',
      significance: 1,
      category: 'case_report' as const,
    };
    const first = await writeEventTool.execute(args, ctx);
    expect(first.ok).toBe(true);
    const second = await writeEventTool.execute(args, ctx);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe('duplicate');
  });
});

describe('readRecentEventsTool', () => {
  it('returns events in created_at DESC order, capped by limit', async () => {
    const sb = adminClient();
    await sb.from('events').insert([
      { title: 'a', summary: 's', source_type: 'who', source_url: 'https://e/a',
        significance: 1, category: 'case_report' },
      { title: 'b', summary: 's', source_type: 'who', source_url: 'https://e/b',
        significance: 1, category: 'case_report' },
    ]);
    const result = await readRecentEventsTool.execute(
      { disease: 'hantavirus', limit: 5 },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.events.length).toBe(2);
      expect(result.events[0].title).toBe('b'); // newer first
    }
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm run test:unit -- events`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the tools**

```ts
// lib/pipeline/tools/events.ts
import { tool } from 'ai';
import { z } from 'zod';
import { adminClient } from '@/lib/supabase-admin';
import { SourceTypeEnum, EventCategoryEnum } from '../types';

export const readRecentEventsTool = tool({
  description:
    'Read recent (non-duplicate) events for deduplication and context. ' +
    'Returns up to `limit` events ordered by created_at DESC.',
  parameters: z.object({
    disease: z.string().default('hantavirus'),
    limit: z.number().int().min(1).max(200).default(60),
  }),
  execute: async ({ disease, limit }) => {
    const sb = adminClient();
    const { data, error } = await sb
      .from('events')
      .select(
        'id, title, summary, source_url, source_type, country_code, category, significance, tags, created_at',
      )
      .eq('disease', disease)
      .is('duplicate_of', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, events: data ?? [] };
  },
});

const WriteEventInputSchema = z.object({
  disease: z.string().default('hantavirus'),
  title: z.string().min(1),
  summary: z.string().min(1),
  raw_content: z.string().optional(),
  source_type: SourceTypeEnum,
  source_url: z.string().url(),
  source_author: z.string().optional(),
  significance: z.number().int().min(1).max(5),
  category: EventCategoryEnum,
  country_code: z.string().length(2).optional(),
  region: z.string().optional(),
  location_name: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  case_count: z.number().int().nonnegative().optional(),
  death_count: z.number().int().nonnegative().optional(),
  is_verified: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  occurred_at: z.string().datetime().optional(),
  duplicate_of: z.string().uuid().optional(),
});

export const writeEventTool = tool({
  description:
    'Insert a new event. URL is hashed and unique-constrained — duplicate URLs ' +
    'return ok:false with error:"duplicate". When you see a known URL hash, do not retry.',
  parameters: WriteEventInputSchema,
  execute: async (input) => {
    const sb = adminClient();
    const { data, error } = await sb
      .from('events')
      .insert(input)
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') {
        return { ok: false as const, error: 'duplicate' };
      }
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const, id: data.id };
  },
});
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm run test:unit -- events`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline/tools/events.ts lib/pipeline/tools/events.test.ts
git commit -m "feat(pipeline): events read and write tools with dedup handling"
```

---

## Task 12: cases + case_locations tools

**Files:**
- Create: `lib/pipeline/tools/cases.ts`
- Test: `lib/pipeline/tools/cases.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/pipeline/tools/cases.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import {
  readMonitoringCasesTool,
  writeCaseTool,
  writeCaseLocationTool,
} from './cases';
import { adminClient } from '@/lib/supabase-admin';

beforeEach(() => {
  execSync('supabase db query "DELETE FROM case_locations; DELETE FROM cases;" --local', { stdio: 'ignore' });
});

const ctx = { toolCallId: 't', messages: [] as never[] };

describe('writeCaseTool', () => {
  it('upserts by case_code', async () => {
    const r1 = await writeCaseTool.execute({
      case_code: 'XX-001',
      status: 'monitoring',
      role: 'passenger',
      display_name: 'Case 1',
    }, ctx);
    expect(r1.ok).toBe(true);

    const r2 = await writeCaseTool.execute({
      case_code: 'XX-001',
      status: 'suspected', // updated
      role: 'passenger',
      display_name: 'Case 1 (updated)',
    }, ctx);
    expect(r2.ok).toBe(true);

    const sb = adminClient();
    const { data } = await sb.from('cases').select('status, display_name').eq('case_code', 'XX-001').single();
    expect(data?.status).toBe('suspected');
    expect(data?.display_name).toBe('Case 1 (updated)');
  });
});

describe('writeCaseLocationTool', () => {
  it('inserts a location and is idempotent on (case_id, arrived_at, transit_id)', async () => {
    const sb = adminClient();
    const { data: c } = await sb.from('cases')
      .insert({ case_code: 'XX-002', status: 'confirmed' })
      .select('id').single();

    const args = {
      case_id: c!.id,
      country_code: 'NL',
      arrived_at: '2026-05-01T10:00:00Z',
      transit_mode: 'flight' as const,
      transit_id: 'KL592',
      transit_origin_code: 'AMS',
      transit_destination_code: 'CPT',
    };
    const r1 = await writeCaseLocationTool.execute(args, ctx);
    expect(r1.ok).toBe(true);

    const r2 = await writeCaseLocationTool.execute(args, ctx);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toBe('duplicate');
  });
});

describe('readMonitoringCasesTool', () => {
  it('returns only status=monitoring cases', async () => {
    const sb = adminClient();
    await sb.from('cases').insert([
      { case_code: 'M-1', status: 'monitoring' },
      { case_code: 'C-1', status: 'confirmed' },
    ]);
    const result = await readMonitoringCasesTool.execute({ disease: 'hantavirus' }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cases.length).toBe(1);
      expect(result.cases[0].case_code).toBe('M-1');
    }
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm run test:unit -- cases`
Expected: FAIL.

- [ ] **Step 3: Implement the tools**

```ts
// lib/pipeline/tools/cases.ts
import { tool } from 'ai';
import { z } from 'zod';
import { adminClient } from '@/lib/supabase-admin';
import { CaseStatusEnum } from '../types';

const RoleEnum = z.enum(['passenger','crew','contact','healthcare_worker','rural_resident','other']);
const ExposureTypeEnum = z.enum(['rodent_contact','person_to_person','unknown']);
const SexEnum = z.enum(['M','F','U']);

export const readMonitoringCasesTool = tool({
  description:
    'Read all cases currently in the monitoring cohort (status=monitoring). ' +
    'Used to know who is already being tracked and to advance their clearance dates.',
  parameters: z.object({
    disease: z.string().default('hantavirus'),
  }),
  execute: async ({ disease }) => {
    const sb = adminClient();
    const { data, error } = await sb
      .from('cases')
      .select('id, case_code, display_name, status, role, current_country, exposure_country, exposure_date, clearance_date, dossier')
      .eq('disease', disease)
      .eq('status', 'monitoring')
      .order('clearance_date', { ascending: true });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, cases: data ?? [] };
  },
});

const WriteCaseInputSchema = z.object({
  disease: z.string().default('hantavirus'),
  case_code: z.string().min(1),
  status: CaseStatusEnum,
  is_index_case: z.boolean().default(false),
  role: RoleEnum.optional(),
  exposure_type: ExposureTypeEnum.optional(),
  age_range: z.string().optional(),
  sex: SexEnum.optional(),
  display_name: z.string().optional(),
  exposure_country: z.string().length(2).optional(),
  exposure_date: z.string().date().optional(),
  onset_date: z.string().date().optional(),
  confirmed_date: z.string().date().optional(),
  outcome_date: z.string().date().optional(),
  clearance_date: z.string().date().optional(),
  current_country: z.string().length(2).optional(),
  dossier: z.string().optional(),
  notes: z.string().optional(),
  source_event_id: z.string().uuid().optional(),
});

export const writeCaseTool = tool({
  description:
    'Upsert a case by case_code. Use when a new person is identified or new info ' +
    'about an existing case is reported. case_code is the stable identifier.',
  parameters: WriteCaseInputSchema,
  execute: async (input) => {
    const sb = adminClient();
    const { data, error } = await sb
      .from('cases')
      .upsert({ ...input, updated_at: new Date().toISOString() }, { onConflict: 'case_code' })
      .select('id')
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, id: data.id };
  },
});

const WriteCaseLocationInputSchema = z.object({
  case_id: z.string().uuid(),
  country_code: z.string().length(2),
  region: z.string().optional(),
  location_name: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  arrived_at: z.string().datetime(),
  departed_at: z.string().datetime().optional(),
  context: z.string().optional(),
  is_exposure_site: z.boolean().default(false),
  transit_mode: z.enum(['flight','ship','land','unknown']).optional(),
  transit_id: z.string().optional(),
  transit_origin_code: z.string().optional(),
  transit_destination_code: z.string().optional(),
});

export const writeCaseLocationTool = tool({
  description:
    'Append a stop to a case\'s travel timeline. ' +
    'For flights or known conveyances, fill transit_mode + transit_id + origin/destination codes ' +
    'so the Palantir trace can label the segment. ' +
    'Idempotent on (case_id, arrived_at, transit_id) — re-inserts return ok:false with error:"duplicate".',
  parameters: WriteCaseLocationInputSchema,
  execute: async (input) => {
    const sb = adminClient();
    const { data, error } = await sb
      .from('case_locations')
      .insert(input)
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') return { ok: false as const, error: 'duplicate' };
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const, id: data.id };
  },
});
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm run test:unit -- cases`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline/tools/cases.ts lib/pipeline/tools/cases.test.ts
git commit -m "feat(pipeline): cases and case_locations tools with idempotency"
```

---

## Task 13: case_relationships tool

**Files:**
- Create: `lib/pipeline/tools/relationships.ts`
- Test: `lib/pipeline/tools/relationships.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/pipeline/tools/relationships.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import { writeCaseRelationshipTool } from './relationships';
import { adminClient } from '@/lib/supabase-admin';

beforeEach(() => {
  execSync(
    'supabase db query "DELETE FROM case_relationships; DELETE FROM case_locations; DELETE FROM cases;" --local',
    { stdio: 'ignore' },
  );
});

const ctx = { toolCallId: 't', messages: [] as never[] };

describe('writeCaseRelationshipTool', () => {
  it('inserts an edge between two cases and is idempotent on (source, target, type)', async () => {
    const sb = adminClient();
    const { data: cs } = await sb.from('cases').insert([
      { case_code: 'A', status: 'confirmed' },
      { case_code: 'B', status: 'monitoring' },
    ]).select('id, case_code');
    const a = cs!.find((c) => c.case_code === 'A')!.id;
    const b = cs!.find((c) => c.case_code === 'B')!.id;

    const args = {
      source_case_id: a,
      target_case_id: b,
      relationship_type: 'infected_by' as const,
      confidence: 0.7,
    };
    const r1 = await writeCaseRelationshipTool.execute(args, ctx);
    expect(r1.ok).toBe(true);

    const r2 = await writeCaseRelationshipTool.execute(args, ctx);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toBe('duplicate');
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm run test:unit -- relationships`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/pipeline/tools/relationships.ts
import { tool } from 'ai';
import { z } from 'zod';
import { adminClient } from '@/lib/supabase-admin';

const RelationshipTypeEnum = z.enum(['infected_by','co_exposed','contact']);

export const writeCaseRelationshipTool = tool({
  description:
    'Record an edge between two cases (A infected_by B, or A co_exposed-with B, or A had contact with B). ' +
    'Only insert when the relationship is reported in a source — do not infer. ' +
    'Idempotent on (source, target, type).',
  parameters: z.object({
    disease: z.string().default('hantavirus'),
    source_case_id: z.string().uuid(),
    target_case_id: z.string().uuid(),
    relationship_type: RelationshipTypeEnum,
    confidence: z.number().min(0).max(1).optional(),
    evidence_event_id: z.string().uuid().optional(),
    notes: z.string().optional(),
  }),
  execute: async (input) => {
    const sb = adminClient();
    const { data, error } = await sb
      .from('case_relationships')
      .insert(input)
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') return { ok: false as const, error: 'duplicate' };
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const, id: data.id };
  },
});
```

- [ ] **Step 4: Run, verify pass**

Run: `npm run test:unit -- relationships`
Expected: 1 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline/tools/relationships.ts lib/pipeline/tools/relationships.test.ts
git commit -m "feat(pipeline): case_relationships tool for transmission graph edges"
```

---

## Task 14: country_stats sync tool

**Files:**
- Create: `lib/pipeline/tools/country-stats.ts`
- Test: `lib/pipeline/tools/country-stats.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/pipeline/tools/country-stats.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import { upsertCountryStatTool, readCountryStatsTool } from './country-stats';
import { adminClient } from '@/lib/supabase-admin';

beforeEach(() => {
  execSync('supabase db query "DELETE FROM country_stats;" --local', { stdio: 'ignore' });
});

const ctx = { toolCallId: 't', messages: [] as never[] };

describe('upsertCountryStatTool', () => {
  it('inserts on first call, updates on second', async () => {
    const r1 = await upsertCountryStatTool.execute({
      country_code: 'NL',
      country_name: 'Netherlands',
      cases: 1,
      deaths: 0,
      status: 'monitoring',
    }, ctx);
    expect(r1.ok).toBe(true);

    const r2 = await upsertCountryStatTool.execute({
      country_code: 'NL',
      country_name: 'Netherlands',
      cases: 2,
      deaths: 0,
      status: 'active',
    }, ctx);
    expect(r2.ok).toBe(true);

    const sb = adminClient();
    const { data } = await sb.from('country_stats').select('cases, status').eq('country_code', 'NL').single();
    expect(data?.cases).toBe(2);
    expect(data?.status).toBe('active');
  });
});

describe('readCountryStatsTool', () => {
  it('returns all rows for the disease', async () => {
    const sb = adminClient();
    await sb.from('country_stats').insert([
      { country_code: 'NL', country_name: 'Netherlands', cases: 2, deaths: 0, status: 'active' },
      { country_code: 'ES', country_name: 'Spain', cases: 2, deaths: 0, status: 'active' },
    ]);
    const result = await readCountryStatsTool.execute({ disease: 'hantavirus' }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.countries.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm run test:unit -- country-stats`

- [ ] **Step 3: Implement**

```ts
// lib/pipeline/tools/country-stats.ts
import { tool } from 'ai';
import { z } from 'zod';
import { adminClient } from '@/lib/supabase-admin';

const CountryStatusEnum = z.enum(['active','contained','monitoring','clear']);

export const readCountryStatsTool = tool({
  description: 'Read all country_stats rows for a disease. Used to know which countries are already tracked.',
  parameters: z.object({
    disease: z.string().default('hantavirus'),
  }),
  execute: async ({ disease }) => {
    const sb = adminClient();
    const { data, error } = await sb
      .from('country_stats')
      .select('country_code, country_name, cases, deaths, first_case_date, latest_case_date, status')
      .eq('disease', disease);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, countries: data ?? [] };
  },
});

export const upsertCountryStatTool = tool({
  description:
    'Upsert a country_stats row by (disease, country_code). ' +
    'Use to add a new country or update existing case/death counts. ' +
    'Pass the FULL desired state — this is an upsert, not a delta.',
  parameters: z.object({
    disease: z.string().default('hantavirus'),
    country_code: z.string().length(2),
    country_name: z.string().min(1),
    cases: z.number().int().nonnegative(),
    deaths: z.number().int().nonnegative(),
    first_case_date: z.string().date().optional(),
    latest_case_date: z.string().date().optional(),
    status: CountryStatusEnum,
    travel_advisory: z.string().optional(),
    notes: z.string().optional(),
  }),
  execute: async (input) => {
    const sb = adminClient();
    const { data, error } = await sb
      .from('country_stats')
      .upsert({ ...input, updated_at: new Date().toISOString() }, { onConflict: 'disease,country_code' })
      .select('id')
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, id: data.id };
  },
});
```

- [ ] **Step 4: Run, verify pass**

Run: `npm run test:unit -- country-stats`

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline/tools/country-stats.ts lib/pipeline/tools/country-stats.test.ts
git commit -m "feat(pipeline): country_stats upsert and read tools"
```

---

## Task 15: facts tools (read + write/upsert)

**Files:**
- Create: `lib/pipeline/tools/facts.ts`
- Test: `lib/pipeline/tools/facts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/pipeline/tools/facts.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import { upsertFactTool, readFactsTool } from './facts';

beforeEach(() => {
  execSync('supabase db query "DELETE FROM facts;" --local', { stdio: 'ignore' });
});

const ctx = { toolCallId: 't', messages: [] as never[] };

describe('upsertFactTool', () => {
  it('inserts a new fact, updates on subsequent calls (same title)', async () => {
    const args = {
      category: 'pathogen' as const,
      title: 'ANDV CFR baseline',
      content: 'CFR ~30%.',
      verification_status: 'corroborated' as const,
      sources: ['https://who.int/x'],
    };
    const r1 = await upsertFactTool.execute(args, ctx);
    expect(r1.ok).toBe(true);
    const r2 = await upsertFactTool.execute(
      { ...args, content: 'CFR ~35%.', verification_status: 'confirmed' as const },
      ctx,
    );
    expect(r2.ok).toBe(true);
    const r3 = await readFactsTool.execute({ disease: 'hantavirus' }, ctx);
    expect(r3.ok).toBe(true);
    if (r3.ok) {
      expect(r3.facts.length).toBe(1);
      expect(r3.facts[0].content).toBe('CFR ~35%.');
      expect(r3.facts[0].verification_status).toBe('confirmed');
    }
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm run test:unit -- facts`

- [ ] **Step 3: Implement**

```ts
// lib/pipeline/tools/facts.ts
import { tool } from 'ai';
import { z } from 'zod';
import { adminClient } from '@/lib/supabase-admin';

const FactCategoryEnum = z.enum([
  'pathogen','transmission','clinical','epidemiology',
  'containment','history','outbreak_timeline','policy',
]);

const VerificationStatusEnum = z.enum([
  'unverified','corroborated','confirmed','disputed','retracted',
]);

export const readFactsTool = tool({
  description: 'Read all facts for a disease. Used for fact-checking new claims and supplying virus-profile content.',
  parameters: z.object({
    disease: z.string().default('hantavirus'),
    category: FactCategoryEnum.optional(),
  }),
  execute: async ({ disease, category }) => {
    const sb = adminClient();
    let q = sb
      .from('facts')
      .select('id, category, title, content, verification_status, confidence, sources, source_types, tags, last_verified_at')
      .eq('disease', disease);
    if (category) q = q.eq('category', category);
    const { data, error } = await q.limit(500);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, facts: data ?? [] };
  },
});

export const upsertFactTool = tool({
  description:
    'Upsert a fact by (disease, title). Use when a claim has been corroborated by ≥2 independent sources. ' +
    'For sequencing reports, set tags including "sequencing", "lab:<name>", "lineage:<name>", "mutations:<list>".',
  parameters: z.object({
    disease: z.string().default('hantavirus'),
    category: FactCategoryEnum,
    title: z.string().min(1),
    content: z.string().min(1),
    verification_status: VerificationStatusEnum,
    confidence: z.number().min(0).max(1).optional(),
    sources: z.array(z.string().url()).min(1),
    source_types: z.array(z.string()).optional(),
    tags: z.array(z.string()).default([]),
    first_reported_at: z.string().datetime().optional(),
  }),
  execute: async (input) => {
    const sb = adminClient();
    const { data, error } = await sb
      .from('facts')
      .upsert(
        { ...input, last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { onConflict: 'disease,title' },
      )
      .select('id')
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, id: data.id };
  },
});
```

- [ ] **Step 4: Run, verify pass**

Run: `npm run test:unit -- facts`

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline/tools/facts.ts lib/pipeline/tools/facts.test.ts
git commit -m "feat(pipeline): facts upsert and read tools with sequencing tag convention"
```

---

## Task 16: Tool registry (export to AI SDK)

**Files:**
- Create: `lib/pipeline/tools/index.ts`

- [ ] **Step 1: Create the registry**

```ts
// lib/pipeline/tools/index.ts
// Tool registry for Phase 1 (Sonnet agent loop).
// Anthropic's web_search_20250305 is added directly in phase1-scrape.ts via the
// anthropic provider's `webSearch_20250305()` helper — it is a server-side tool
// and is not the same shape as user-defined tools.

import { webFetchTool } from './web-fetch';
import { readRecentEventsTool, writeEventTool } from './events';
import {
  readMonitoringCasesTool,
  writeCaseTool,
  writeCaseLocationTool,
} from './cases';
import { writeCaseRelationshipTool } from './relationships';
import { readCountryStatsTool, upsertCountryStatTool } from './country-stats';
import { readFactsTool, upsertFactTool } from './facts';

export const phase1Tools = {
  web_fetch: webFetchTool,
  read_recent_events: readRecentEventsTool,
  write_event: writeEventTool,
  read_monitoring_cases: readMonitoringCasesTool,
  write_case: writeCaseTool,
  write_case_location: writeCaseLocationTool,
  write_case_relationship: writeCaseRelationshipTool,
  read_country_stats: readCountryStatsTool,
  upsert_country_stat: upsertCountryStatTool,
  read_facts: readFactsTool,
  upsert_fact: upsertFactTool,
} as const;
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/pipeline/tools/index.ts
git commit -m "feat(pipeline): export Phase 1 tool registry"
```

---

## Task 17: Polymarket fetcher (non-AI)

**Files:**
- Create: `lib/pipeline/polymarket.ts`
- Test: `lib/pipeline/polymarket.test.ts`

> **Note for the engineer:** Polymarket's REST API endpoint and exact slug strings change occasionally. The fetcher must tolerate any individual market being missing (return `null` for that field, not throw). The test mocks the fetch — the real endpoint is exercised via the smoke test.

- [ ] **Step 1: Write the failing test**

```ts
// lib/pipeline/polymarket.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPolymarket } from './polymarket';

describe('fetchPolymarket', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null for any market the fetch cannot resolve, but still returns the snapshot', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const snap = await fetchPolymarket();
    expect(snap.pandemic).toBeNull();
    expect(snap.us_case).toBeNull();
    expect(snap.fetched_at).toMatch(/Z$/);
    expect(fetchSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm run test:unit -- polymarket`

- [ ] **Step 3: Implement**

```ts
// lib/pipeline/polymarket.ts
import type { PolymarketSnapshot } from './types';

const POLYMARKET_API = 'https://gamma-api.polymarket.com/markets';

const MARKET_SLUGS = {
  pandemic: 'will-there-be-a-pandemic-in-2026',
  us_case: 'will-the-us-have-a-confirmed-andv-case-by-may-15-2026',
  vaccine: 'andv-vaccine-approved-2026',
  lab_leak: 'andv-lab-leak-confirmed-by-jun-30-2026',
} as const;

type Slug = keyof typeof MARKET_SLUGS;

async function fetchOne(slug: string): Promise<number | null> {
  try {
    const url = `${POLYMARKET_API}?slug=${encodeURIComponent(slug)}&closed=false`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5_000),
      headers: { 'User-Agent': 'Pathwatch-Pipeline/1.0' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{ outcomePrices?: string }>;
    if (!Array.isArray(json) || json.length === 0) return null;
    const prices = JSON.parse(json[0].outcomePrices ?? '[]');
    const yes = parseFloat(prices[0]);
    return Number.isFinite(yes) ? yes : null;
  } catch {
    return null;
  }
}

export async function fetchPolymarket(): Promise<PolymarketSnapshot> {
  const entries = await Promise.all(
    (Object.entries(MARKET_SLUGS) as Array<[Slug, string]>).map(
      async ([key, slug]) => [key, await fetchOne(slug)] as const,
    ),
  );
  const result: PolymarketSnapshot = {
    pandemic: null,
    us_case: null,
    vaccine: null,
    lab_leak: null,
    fetched_at: new Date().toISOString(),
  };
  for (const [k, v] of entries) result[k] = v;
  return result;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm run test:unit -- polymarket`

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline/polymarket.ts lib/pipeline/polymarket.test.ts
git commit -m "feat(pipeline): polymarket fetcher with graceful fallback to nulls"
```

---

## Task 18: Phase 3 — scrape_log writer

**Files:**
- Create: `lib/pipeline/phase3-log.ts`
- Test: `lib/pipeline/phase3-log.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/pipeline/phase3-log.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import { writeScrapeLog } from './phase3-log';
import { adminClient } from '@/lib/supabase-admin';

beforeEach(() => {
  execSync('supabase db query "DELETE FROM scrape_log;" --local', { stdio: 'ignore' });
});

describe('writeScrapeLog', () => {
  it('inserts a row capturing all phase metrics', async () => {
    await writeScrapeLog({
      delta: {
        search_results_found: 30,
        events_created: 4,
        events_skipped_duplicates: 26,
        cases_created: 1,
        cases_updated: 2,
        case_locations_created: 3,
        relationships_created: 1,
        facts_created: 0,
        facts_updated: 1,
        country_stats_synced: 2,
        cost_usd: 0.5,
      },
      threat_written: true,
      snapshot_written: false,
      duration_ms: 350_000,
      total_cost_usd: 1.0,
    });

    const sb = adminClient();
    const { data } = await sb.from('scrape_log').select('*').single();
    expect(data?.events_created).toBe(4);
    expect(data?.duplicates_skipped).toBe(26);
    expect(data?.cases_created).toBe(1);
    expect(data?.relationships_created).toBe(1);
    expect(data?.threat_written).toBe(true);
    expect(data?.snapshot_written).toBe(false);
    expect(data?.error).toBeNull();
  });

  it('writes an error row when given an error', async () => {
    await writeScrapeLog({
      delta: null,
      threat_written: false,
      snapshot_written: false,
      duration_ms: 12_000,
      total_cost_usd: 0,
      error: 'something exploded',
      error_phase: 'analyze',
    });
    const sb = adminClient();
    const { data } = await sb.from('scrape_log').select('error, error_phase').single();
    expect(data?.error).toBe('something exploded');
    expect(data?.error_phase).toBe('analyze');
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm run test:unit -- phase3-log`

- [ ] **Step 3: Implement**

```ts
// lib/pipeline/phase3-log.ts
import { adminClient } from '@/lib/supabase-admin';
import type { PipelineDelta } from './types';

export interface WriteScrapeLogInput {
  delta: PipelineDelta | null;
  threat_written: boolean;
  snapshot_written: boolean;
  duration_ms: number;
  total_cost_usd: number;
  error?: string;
  error_phase?: 'scrape' | 'analyze' | 'log';
}

export async function writeScrapeLog(input: WriteScrapeLogInput): Promise<void> {
  const sb = adminClient();
  const { error } = await sb.from('scrape_log').insert({
    source_type: 'pipeline',
    results_found: input.delta?.search_results_found ?? 0,
    events_created: input.delta?.events_created ?? 0,
    duplicates_skipped: input.delta?.events_skipped_duplicates ?? 0,
    cases_created: input.delta?.cases_created ?? 0,
    facts_created: input.delta?.facts_created ?? 0,
    relationships_created: input.delta?.relationships_created ?? 0,
    threat_written: input.threat_written,
    snapshot_written: input.snapshot_written,
    error: input.error ?? null,
    error_phase: input.error_phase ?? null,
    duration_ms: input.duration_ms,
    total_cost_usd: input.total_cost_usd,
  });
  if (error) {
    // Log to stderr — caller will already be in an error path
    console.error('[pipeline] failed to write scrape_log:', error.message);
  }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm run test:unit -- phase3-log`

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline/phase3-log.ts lib/pipeline/phase3-log.test.ts
git commit -m "feat(pipeline): scrape_log writer for cycle observability"
```

---

## Task 19: Phase 1 system prompt

**Files:**
- Create: `lib/pipeline/prompts/phase1-system.md`

- [ ] **Step 1: Create the prompt file**

The Phase 1 prompt is large (the runbook content lives here). Use this exact content:

```markdown
You are the Pathwatch scraping and processing agent. Your job each cycle is to find new public-health intelligence about a specific disease and write it to a Supabase database via the tools available to you.

You will be told the disease and the current date. The dashboard at https://pathwatch-phi.vercel.app reads what you write.

# Sources, in priority order

1. WHO Disease Outbreak News — https://www.who.int/emergencies/disease-outbreak-news
2. CDC RSS — https://tools.cdc.gov/api/v2/resources/media/rss (filter for disease terms)
3. ECDC — https://www.ecdc.europa.eu/en
4. Africa CDC — https://africacdc.org/
5. Major news (search) — Reuters, AP, BBC, Al Jazeera, NYT, WaPo, Guardian
6. Wikipedia outbreak page (if one exists)
7. Reddit r/worldnews, r/medicine, r/epidemiology, r/health (only when others have nothing new)

You have web_search (from Anthropic, automatic) and a `web_fetch` tool for fetching specific URLs you've found.

# Your tools

- `web_fetch(url, max_bytes, timeout_ms)` — fetch one HTTPS URL
- `read_recent_events(disease, limit)` — see what's already in the DB
- `write_event(...)` — insert a new event (URL-deduplicated)
- `read_monitoring_cases(disease)` — see who's currently in the monitoring cohort
- `write_case(...)` — upsert a case by case_code
- `write_case_location(...)` — append a stop to a case's travel timeline
- `write_case_relationship(...)` — record an edge in the transmission graph
- `read_country_stats(disease)` — see current country totals
- `upsert_country_stat(...)` — write the FULL desired state for a country (it's an upsert)
- `read_facts(disease, category?)` — see corroborated facts
- `upsert_fact(...)` — write a fact (use only when ≥2 independent sources corroborate)

# Your cycle, in order

1. **Read what's known.** Call `read_recent_events` (limit 60), `read_monitoring_cases`, `read_country_stats`, and `read_facts`. This is your reference state.

2. **Search for what's new.** Use web_search for queries about the disease, its known outbreak context, and current developments. Search for terms appearing in your reference state to find updates (e.g., known case names, vessel names, mutation names).

3. **For each candidate item:**
   - If the URL is already in `read_recent_events` results → skip
   - If the story is the same as an existing event but from a new source → still write a new event with `duplicate_of` set to the original event's id (this counts as corroboration)
   - Otherwise it's new — write the event

4. **Score each event:**
   - **5 (critical):** first case in a new country, major policy change, large death-toll change, WHO emergency declaration
   - **4 (high):** official government statement, travel advisory, new research findings
   - **3 (notable):** case-count update, expert opinion, containment measure
   - **2 (low):** local news, useful social-media discussion
   - **1 (routine):** general discussion, speculation, reposts of known info

5. **Tag consistently:**
   - Strain (`andes-virus`, `sin-nombre`, etc.)
   - Context (`mv-hondius`, `outbreak-2026a`)
   - Topic (`transmission`, `cfr`, `human-to-human`, `mutation`, `policy`, `containment`)
   - For sequencing reports, also include: `sequencing`, `lab:<name>`, `lineage:<name>`, `mutations:<comma-list-or-none>`

6. **Identify and write cases.** When a news item identifies a person (named or by unique descriptor), `write_case` with a stable `case_code` (e.g. `ES-001`, `KL592-attendant`). For each location they've been to, `write_case_location`. When a flight or vessel is involved, fill `transit_mode`, `transit_id`, `transit_origin_code`, `transit_destination_code`.

7. **Update the monitoring cohort.** For each row from `read_monitoring_cases`:
   - If the person's `clearance_date` is past today's date AND no symptoms reported → set status to `recovered` via `write_case`
   - If new info reports symptoms or hospitalization → update status to `suspected` or `confirmed`

8. **Sync country_stats.** For each country mentioned in new events, ensure a `country_stats` row exists. Update case/death counts if they changed. Use `upsert_country_stat` with the FULL desired state.

9. **Fact-check claims.** When a numeric or factual claim appears in ≥2 independent Tier-1 or Tier-2 sources, `upsert_fact` with the claim. If a new source contradicts a stored fact, do not auto-update — write an event tagged `contradicts-known-fact` and let the next analysis cycle handle it.

10. **Record transmission edges.** When a source reports that case A was infected by case B (or A and B were co-exposed), call `write_case_relationship`.

# Hard rules

- **If you can't reach a source, do not write events from it.** Skip and move on.
- **Skip duplicates.** If a tool returns `error: "duplicate"`, that's expected, not a failure. Do not retry.
- **Never invent data.** If a source says "around 30 cases," do not write `case_count: 30` — write what they said in the summary and leave the structured field null.
- **No speculation as fact.** A Reddit thread is `significance: 1-2`, not `5`, regardless of how dramatic it is.
- **Stop when you've covered the priority sources.** Do not loop indefinitely. Aim for ≤30 tool calls per cycle.

# Output

When done, return a one-paragraph summary of what you wrote: how many events, cases, relationships, facts. The orchestrator computes the actual delta from the tool results — your text summary is for human readability in logs.
```

- [ ] **Step 2: Commit**

```bash
git add lib/pipeline/prompts/phase1-system.md
git commit -m "feat(pipeline): add Phase 1 (Sonnet) system prompt with full runbook"
```

---

## Task 20: Phase 2 system prompt

**Files:**
- Create: `lib/pipeline/prompts/phase2-system.md`

- [ ] **Step 1: Create the prompt file**

```markdown
You are the Pathwatch threat assessment and snapshot analyst. You receive the current state of a disease outbreak from a database read, and a set of new events written by the scraping agent in this cycle, and a Polymarket snapshot. You return a structured analysis.

You will be given:
- The most recent prior threat_assessment (or null if first cycle)
- The most recent prior snapshot (or null if first cycle)
- All events from the past 7 days
- All current facts
- All cases with their current status, locations, and relationships
- Today's Polymarket pandemic odds for context

# Your output

A single JSON object validated by the schema you've been given. Two parts:

## 1. `threat` — always emitted

A complete threat_assessments record:

- `pandemic_probability` — your calibrated 0–1 estimate. Calibration: a probability of 0.30 means "if I made this exact call 100 times in similar evidence states, I'd expect about 30 to result in a declared pandemic." This is NOT the polymarket odds — it's your model's view, which may differ.
- `threat_level` — `minimal | low | moderate | elevated | high | critical`. Match it to the probability bucket: minimal <2%, low 2–5%, moderate 5–15%, elevated 15–30%, high 30–60%, critical >60%.
- `summary` — one paragraph (3–6 sentences) suitable for the dashboard. State the change since last assessment first, then the current state, then what to watch.
- `reasoning` — your show-your-work. Multiple paragraphs. Walk through what changed, what evidence supports the call, what uncertainties remain. This is read by the operator to decide whether to trust your output.
- `r0_estimate` — based on the case_relationships graph plus epidemiological judgment. Null if insufficient data.
- `r0_assessment` — one-sentence interpretation
- `mutation_status` — read from sequencing reports in events/facts. Null-equivalent values: `none_detected` (no mutations reported), `monitoring` (mutations reported, no functional impact), `concerning` (mutations with potential functional impact), `critical` (mutations confirmed to enhance transmissibility or immune escape)
- `mutation_notes` — narrative
- `secondary_attack_rate` — 0–1; from case_relationships where you can identify primary cases and attempts. Null if insufficient data
- `secondary_attack_notes` — narrative
- `case_doubling_days` — null if insufficient data
- `containment_effectiveness` — `effective | partially_effective | failing | unknown`
- `ai_vs_market_note` — one sentence comparing your `pandemic_probability` to Polymarket. Acknowledge if Polymarket has different information than you (e.g., short-term betting markets price near-term news that's outside your timeframe)
- `triggers_watching` — array of plain-English conditions you're tracking. Examples: "first case in Asia", "case_doubling_days drops below 5", "human-to-human transmission outside the index cluster"
- `triggers_tripped` — any from `triggers_watching` of prior cycles that have now occurred this cycle

## 2. `snapshot` — emitted only when material change

Emit a snapshot object ONLY when AT LEAST ONE of these is true vs the most recent prior snapshot:
- `total_cases` changed
- `total_deaths` changed
- `countries_affected` count changed
- `fatality_rate` changed by ≥0.5 percentage points
- `key_developments` would have at least one new entry

Otherwise, set `snapshot` to `null` — the orchestrator will skip writing a row.

When emitted, the snapshot has:
- `total_cases`, `total_deaths`, `countries_affected` — counted from cases + country_stats
- `countries_list` — array of country codes
- `fatality_rate` — total_deaths / total_cases (0–1, null-safe to 0 if total_cases=0)
- `trend` — `accelerating | stable | declining`
- `trend_description` — one sentence
- `risk_level` — `low | moderate | high | critical` (matches the threat_level bucket)
- `key_developments` — 3–6 bullets, each ≤150 chars, of the most material changes since the prior snapshot
- `ai_analysis` — the long-form Situation Brief paragraph(s). Concrete, factual, operator-facing voice. Same tone as a clear-headed intelligence brief. ~150–300 words.

# Hard rules

- **Never overstate certainty.** If two sources disagree, say so in `reasoning`.
- **Never invent numbers.** If you can't compute SAR from data, return null.
- **The `summary` is what the user sees first** — make it clear and useful, not hedged into uselessness.
- **Output only valid JSON matching the schema.** The orchestrator validates with Zod and will reject malformed output.
```

- [ ] **Step 2: Commit**

```bash
git add lib/pipeline/prompts/phase2-system.md
git commit -m "feat(pipeline): add Phase 2 (Opus) system prompt for threat assessment"
```

---

## Task 21: Phase 1 — Sonnet agent loop

**Files:**
- Create: `lib/pipeline/phase1-scrape.ts`

- [ ] **Step 1: Implement Phase 1**

```ts
// lib/pipeline/phase1-scrape.ts
import { generateText, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { phase1Tools } from './tools';
import type { PipelineDelta } from './types';

const SYSTEM_PROMPT = readFileSync(
  path.join(process.cwd(), 'lib/pipeline/prompts/phase1-system.md'),
  'utf8',
);

export interface Phase1Result {
  delta: PipelineDelta;
  cost_usd: number;
  steps: number;
  error?: string;
}

export async function runPhase1(disease: string): Promise<Phase1Result> {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content:
            `Run a pipeline cycle. disease=${disease}. Today is ${today}. ` +
            `Read existing state first, then search for new info, then write. Stop when priority sources are covered.`,
        },
      ],
      tools: {
        ...phase1Tools,
        web_search: anthropic.tools.webSearch_20250305({ maxUses: 8 }),
      },
      stopWhen: stepCountIs(40),
      providerOptions: {
        anthropic: {
          // Cache the (large, static) system prompt + tool definitions across cycles.
          cacheControl: { type: 'ephemeral' },
        },
      },
    });

    const delta = computeDelta(result.steps);
    const cost = extractCost(result);
    return { delta, cost_usd: cost, steps: result.steps.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      delta: emptyDelta(),
      cost_usd: 0,
      steps: 0,
      error: msg,
    };
  }
}

function emptyDelta(): PipelineDelta {
  return {
    search_results_found: 0,
    events_created: 0,
    events_skipped_duplicates: 0,
    cases_created: 0,
    cases_updated: 0,
    case_locations_created: 0,
    relationships_created: 0,
    facts_created: 0,
    facts_updated: 0,
    country_stats_synced: 0,
    cost_usd: 0,
  };
}

// Walk the model's tool-call history to count what was actually written.
function computeDelta(steps: ReadonlyArray<unknown>): PipelineDelta {
  const d = emptyDelta();
  for (const step of steps as Array<{
    toolCalls?: Array<{ toolName: string }>;
    toolResults?: Array<{ toolName: string; output?: unknown }>;
  }>) {
    for (const tc of step.toolCalls ?? []) {
      if (tc.toolName === 'web_search') d.search_results_found += 1;
    }
    for (const r of step.toolResults ?? []) {
      const out = r.output as { ok?: boolean; error?: string } | undefined;
      const ok = out?.ok === true;
      switch (r.toolName) {
        case 'write_event':
          if (ok) d.events_created += 1;
          else if (out?.error === 'duplicate') d.events_skipped_duplicates += 1;
          break;
        case 'write_case':
          if (ok) d.cases_created += 1; // upserts; we count writes, not net inserts
          break;
        case 'write_case_location':
          if (ok) d.case_locations_created += 1;
          break;
        case 'write_case_relationship':
          if (ok) d.relationships_created += 1;
          break;
        case 'upsert_country_stat':
          if (ok) d.country_stats_synced += 1;
          break;
        case 'upsert_fact':
          if (ok) d.facts_created += 1;
          break;
      }
    }
  }
  return d;
}

function extractCost(result: { usage?: unknown }): number {
  // AI SDK exposes usage; cost computed from input/output tokens × model price.
  // For now read the cost directly if the SDK exposes it; otherwise default to 0.
  const u = result.usage as { totalCost?: number } | undefined;
  return typeof u?.totalCost === 'number' ? u.totalCost : 0;
}
```

> **Verification note for the engineer:** the AI SDK's exact return shape for `result.steps` and `result.usage` varies by version. If `usage.totalCost` is not present, compute cost from `input_tokens` and `output_tokens` against Anthropic's published Sonnet 4.6 pricing ($3 / $15 per 1M; cached input $0.30 / 1M). Update `extractCost` accordingly. Run a single smoke cycle and `console.log(result.usage)` to see the exact shape.

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: no errors. (If errors, the AI SDK version may have a slightly different API — adapt the call signature, but keep the structure: `generateText` + `system` + `messages` + `tools` + `stopWhen` + `providerOptions.anthropic.cacheControl`.)

- [ ] **Step 3: Commit**

```bash
git add lib/pipeline/phase1-scrape.ts
git commit -m "feat(pipeline): Phase 1 Sonnet agent loop with tool registry and cache control"
```

---

## Task 22: Phase 2 — Opus structured analysis + writes

**Files:**
- Create: `lib/pipeline/phase2-analyze.ts`

- [ ] **Step 1: Implement Phase 2**

```ts
// lib/pipeline/phase2-analyze.ts
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { adminClient } from '@/lib/supabase-admin';
import { fetchPolymarket } from './polymarket';
import {
  AnalysisOutputSchema,
  type AnalysisOutput,
  type PolymarketSnapshot,
} from './types';

const SYSTEM_PROMPT = readFileSync(
  path.join(process.cwd(), 'lib/pipeline/prompts/phase2-system.md'),
  'utf8',
);

export interface Phase2Result {
  threat_written: boolean;
  snapshot_written: boolean;
  cost_usd: number;
  error?: string;
}

export async function runPhase2(disease: string): Promise<Phase2Result> {
  const sb = adminClient();
  const today = new Date().toISOString().slice(0, 10);

  try {
    // Gather inputs in parallel.
    const [polymarket, priorThreatRes, priorSnapRes, eventsRes, factsRes, casesRes, locationsRes, relationshipsRes, countryStatsRes] = await Promise.all([
      fetchPolymarket(),
      sb.from('threat_assessments').select('*').eq('disease', disease).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      sb.from('snapshots').select('*').eq('disease', disease).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      sb.from('events').select('id, title, summary, source_type, source_url, significance, category, country_code, tags, created_at, occurred_at').eq('disease', disease).is('duplicate_of', null).gte('created_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
      sb.from('facts').select('id, category, title, content, verification_status, sources, tags').eq('disease', disease),
      sb.from('cases').select('id, case_code, status, role, exposure_country, current_country, exposure_date, onset_date, confirmed_date, clearance_date').eq('disease', disease),
      sb.from('case_locations').select('case_id, country_code, arrived_at, transit_mode, transit_id'),
      sb.from('case_relationships').select('source_case_id, target_case_id, relationship_type, confidence').eq('disease', disease),
      sb.from('country_stats').select('country_code, country_name, cases, deaths, status, first_case_date, latest_case_date').eq('disease', disease),
    ]);

    const userMessage = buildUserMessage({
      disease,
      today,
      polymarket,
      priorThreat: priorThreatRes.data,
      priorSnapshot: priorSnapRes.data,
      events: eventsRes.data ?? [],
      facts: factsRes.data ?? [],
      cases: casesRes.data ?? [],
      caseLocations: locationsRes.data ?? [],
      relationships: relationshipsRes.data ?? [],
      countryStats: countryStatsRes.data ?? [],
    });

    const { object, usage } = await generateObject({
      model: anthropic('claude-opus-4-7', {
        // 1M-context beta header
        cacheControl: false,
      }),
      schema: AnalysisOutputSchema,
      system: SYSTEM_PROMPT,
      prompt: userMessage,
      headers: { 'anthropic-beta': 'context-1m-2025-08-07' },
    });

    const cost = extractCost(usage);

    // Write threat_assessments — every cycle.
    const threatRow = {
      disease,
      model: 'claude-opus-4-7',
      pandemic_probability: object.threat.pandemic_probability,
      threat_level: object.threat.threat_level,
      summary: object.threat.summary,
      reasoning: object.threat.reasoning,
      r0_estimate: object.threat.r0_estimate,
      r0_assessment: object.threat.r0_assessment,
      mutation_status: object.threat.mutation_status,
      mutation_notes: object.threat.mutation_notes,
      secondary_attack_rate: object.threat.secondary_attack_rate,
      secondary_attack_notes: object.threat.secondary_attack_notes,
      case_doubling_days: object.threat.case_doubling_days,
      containment_effectiveness: object.threat.containment_effectiveness,
      polymarket_pandemic_odds: polymarket.pandemic,
      polymarket_us_case_odds: polymarket.us_case,
      polymarket_vaccine_odds: polymarket.vaccine,
      polymarket_lab_leak_odds: polymarket.lab_leak,
      polymarket_fetched_at: polymarket.fetched_at,
      ai_vs_market_note: object.threat.ai_vs_market_note,
      triggers_watching: object.threat.triggers_watching,
      triggers_tripped: object.threat.triggers_tripped,
    };

    const { error: tErr } = await sb.from('threat_assessments').insert(threatRow);
    if (tErr) throw new Error(`threat_assessments insert: ${tErr.message}`);

    // Write snapshot — only when material change (Phase 2 emits null otherwise).
    let snapshot_written = false;
    if (object.snapshot !== null) {
      const { error: sErr } = await sb.from('snapshots').insert({
        disease,
        ...object.snapshot,
      });
      if (sErr) throw new Error(`snapshots insert: ${sErr.message}`);
      snapshot_written = true;
    }

    return {
      threat_written: true,
      snapshot_written,
      cost_usd: cost,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      threat_written: false,
      snapshot_written: false,
      cost_usd: 0,
      error: msg,
    };
  }
}

function buildUserMessage(input: {
  disease: string;
  today: string;
  polymarket: PolymarketSnapshot;
  priorThreat: unknown;
  priorSnapshot: unknown;
  events: unknown[];
  facts: unknown[];
  cases: unknown[];
  caseLocations: unknown[];
  relationships: unknown[];
  countryStats: unknown[];
}): string {
  return [
    `Disease: ${input.disease}`,
    `Today: ${input.today}`,
    '',
    `Polymarket snapshot:`,
    JSON.stringify(input.polymarket, null, 2),
    '',
    `Most recent prior threat_assessment:`,
    JSON.stringify(input.priorThreat, null, 2),
    '',
    `Most recent prior snapshot:`,
    JSON.stringify(input.priorSnapshot, null, 2),
    '',
    `Events (last 7 days, non-duplicate):`,
    JSON.stringify(input.events, null, 2),
    '',
    `Facts:`,
    JSON.stringify(input.facts, null, 2),
    '',
    `Cases:`,
    JSON.stringify(input.cases, null, 2),
    '',
    `Case locations (transmission graph adjacency):`,
    JSON.stringify(input.caseLocations, null, 2),
    '',
    `Case relationships (transmission graph edges):`,
    JSON.stringify(input.relationships, null, 2),
    '',
    `Country stats:`,
    JSON.stringify(input.countryStats, null, 2),
    '',
    `Produce the JSON analysis as specified in your system prompt.`,
  ].join('\n');
}

function extractCost(usage: unknown): number {
  const u = usage as { totalCost?: number } | undefined;
  return typeof u?.totalCost === 'number' ? u.totalCost : 0;
}
```

> **Verification note for the engineer:** `generateObject` and the headers/cacheControl options on `@ai-sdk/anthropic` may differ slightly across versions. If the 1M-context header doesn't apply at the SDK call level in your version, set it via `providerOptions.anthropic.headers` instead. The structural pattern — single call with Zod schema, returns `{ object, usage }` — is stable across recent versions.

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`

- [ ] **Step 3: Commit**

```bash
git add lib/pipeline/phase2-analyze.ts
git commit -m "feat(pipeline): Phase 2 Opus structured analysis with snapshot delta gate"
```

---

## Task 23: Orchestrator (runPipeline)

**Files:**
- Create: `lib/pipeline/index.ts`

- [ ] **Step 1: Implement orchestrator**

```ts
// lib/pipeline/index.ts
import { randomUUID } from 'node:crypto';
import { runPhase1 } from './phase1-scrape';
import { runPhase2 } from './phase2-analyze';
import { writeScrapeLog } from './phase3-log';
import type { PipelineResult } from './types';

export async function runPipeline(disease: string): Promise<PipelineResult> {
  const cycle_id = randomUUID();
  const started = Date.now();

  const phase1 = await runPhase1(disease);
  if (phase1.error) {
    const duration = Date.now() - started;
    await writeScrapeLog({
      delta: phase1.delta,
      threat_written: false,
      snapshot_written: false,
      duration_ms: duration,
      total_cost_usd: phase1.cost_usd,
      error: phase1.error,
      error_phase: 'scrape',
    });
    return {
      ok: false,
      cycle_id,
      duration_ms: duration,
      delta: phase1.delta,
      threat_written: false,
      snapshot_written: false,
      total_cost_usd: phase1.cost_usd,
      error: phase1.error,
      error_phase: 'scrape',
    };
  }

  const phase2 = await runPhase2(disease);
  const total_cost_usd = phase1.cost_usd + phase2.cost_usd;
  const duration = Date.now() - started;

  if (phase2.error) {
    await writeScrapeLog({
      delta: phase1.delta,
      threat_written: false,
      snapshot_written: false,
      duration_ms: duration,
      total_cost_usd,
      error: phase2.error,
      error_phase: 'analyze',
    });
    return {
      ok: false,
      cycle_id,
      duration_ms: duration,
      delta: phase1.delta,
      threat_written: false,
      snapshot_written: false,
      total_cost_usd,
      error: phase2.error,
      error_phase: 'analyze',
    };
  }

  await writeScrapeLog({
    delta: phase1.delta,
    threat_written: phase2.threat_written,
    snapshot_written: phase2.snapshot_written,
    duration_ms: duration,
    total_cost_usd,
  });

  return {
    ok: true,
    cycle_id,
    duration_ms: duration,
    delta: phase1.delta,
    threat_written: phase2.threat_written,
    snapshot_written: phase2.snapshot_written,
    total_cost_usd,
  };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`

- [ ] **Step 3: Commit**

```bash
git add lib/pipeline/index.ts
git commit -m "feat(pipeline): runPipeline orchestrator with try/finally scrape_log"
```

---

## Task 24: Auth (cron secret verification)

**Files:**
- Create: `lib/pipeline/auth.ts`
- Test: `lib/pipeline/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/pipeline/auth.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { verifyCronSecret } from './auth';

const ORIGINAL = process.env.CRON_SECRET;

beforeEach(() => {
  process.env.CRON_SECRET = 'top-secret-value';
});
afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL;
});

describe('verifyCronSecret', () => {
  it('accepts a request with the correct bearer token', () => {
    const req = new Request('https://x', {
      headers: { authorization: 'Bearer top-secret-value' },
    });
    expect(verifyCronSecret(req)).toBe(true);
  });

  it('rejects a request with the wrong token', () => {
    const req = new Request('https://x', {
      headers: { authorization: 'Bearer wrong' },
    });
    expect(verifyCronSecret(req)).toBe(false);
  });

  it('rejects a request with no auth header', () => {
    const req = new Request('https://x');
    expect(verifyCronSecret(req)).toBe(false);
  });

  it('throws if CRON_SECRET is not set in env', () => {
    delete process.env.CRON_SECRET;
    const req = new Request('https://x', { headers: { authorization: 'Bearer x' } });
    expect(() => verifyCronSecret(req)).toThrow();
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm run test:unit -- pipeline/auth`

- [ ] **Step 3: Implement**

```ts
// lib/pipeline/auth.ts
export function verifyCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    throw new Error('CRON_SECRET is not set in environment');
  }
  const header = request.headers.get('authorization');
  if (!header) return false;
  const match = /^Bearer\s+(.+)$/.exec(header);
  if (!match) return false;
  // Constant-time-ish comparison: simple equality on small strings is fine here
  return match[1] === expected;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm run test:unit -- pipeline/auth`

- [ ] **Step 5: Commit**

```bash
git add lib/pipeline/auth.ts lib/pipeline/auth.test.ts
git commit -m "feat(pipeline): cron secret verification"
```

---

## Task 25: HTTP route handler

**Files:**
- Create: `app/api/cron/pipeline/route.ts`

- [ ] **Step 1: Implement the route**

```ts
// app/api/cron/pipeline/route.ts
import { NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/pipeline/auth';
import { runPipeline } from '@/lib/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 800; // 13.3 minutes — Fluid Compute on Pro
export const preferredRegion = 'iad1'; // co-located with Supabase project

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const disease = url.searchParams.get('disease') ?? 'hantavirus';

  const result = await runPipeline(disease);
  const status = result.ok ? 200 : 500;
  return NextResponse.json(result, { status });
}

// Allow Vercel Cron's GET requests as a fallback.
export async function GET(request: Request) {
  return POST(request);
}
```

- [ ] **Step 2: Verify typecheck and dev startup**

Run: `npm run typecheck`
Expected: no errors.

Optionally: `npm run dev` then `curl -X POST http://localhost:3000/api/cron/pipeline` — expect 401 (no auth header).

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/pipeline/route.ts
git commit -m "feat(pipeline): /api/cron/pipeline route with auth and 800s maxDuration"
```

---

## Task 26: Vercel cron configuration

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Update vercel.json**

Replace the contents of `vercel.json` with:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "crons": [
    {
      "path": "/api/cron/pipeline?disease=hantavirus",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

- [ ] **Step 2: Set CRON_SECRET in Vercel project env (production + preview)**

Run:

```bash
# Generate a secret
openssl rand -hex 32
# Then add to Vercel — interactive
vercel env add CRON_SECRET production
vercel env add CRON_SECRET preview
```

When prompted, paste the same value generated above. Also set `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` in Vercel (production + preview).

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat(pipeline): add Vercel Cron entry — every 6h hantavirus cycle"
```

---

## Task 27: Smoke test script

**Files:**
- Create: `scripts/pipeline-smoke.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Write the smoke script**

```ts
// scripts/pipeline-smoke.ts
// Manually run one full pipeline cycle against the local Supabase + real Anthropic API.
// Costs ~$1 per run. Use to verify end-to-end before deploying.
//
// Prereqs: .env.local has SUPABASE_SERVICE_ROLE_KEY and ANTHROPIC_API_KEY.
// Run: npx tsx scripts/pipeline-smoke.ts

import 'dotenv/config';
import { runPipeline } from '@/lib/pipeline';
import { adminClient } from '@/lib/supabase-admin';

async function main() {
  const disease = process.argv[2] ?? 'hantavirus';
  console.log(`[smoke] starting pipeline for disease=${disease}`);
  const started = Date.now();
  const result = await runPipeline(disease);
  const elapsed = Date.now() - started;
  console.log(`[smoke] result:`, JSON.stringify(result, null, 2));
  console.log(`[smoke] elapsed: ${(elapsed / 1000).toFixed(1)}s`);

  // Verify scrape_log row landed.
  const sb = adminClient();
  const { data: log } = await sb
    .from('scrape_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  console.log(`[smoke] latest scrape_log row:`, log);

  if (!result.ok) {
    console.error(`[smoke] FAILED in phase ${result.error_phase}: ${result.error}`);
    process.exit(1);
  }
  console.log(`[smoke] OK`);
}

main().catch((err) => {
  console.error(`[smoke] threw:`, err);
  process.exit(1);
});
```

- [ ] **Step 2: Install tsx + dotenv if needed**

Run:

```bash
npm install -D tsx dotenv
```

- [ ] **Step 3: Add the npm script**

In `package.json` `"scripts"` block, add:

```json
"pipeline:smoke": "tsx scripts/pipeline-smoke.ts"
```

- [ ] **Step 4: Run the smoke**

Run: `npm run pipeline:smoke`
Expected: Phase 1 + Phase 2 complete; scrape_log row visible at end. Costs ~$1.

**Caveat:** the smoke uses local Supabase (`http://127.0.0.1:54321`) via `adminClient()` reading `.env.local`. If your local DB is empty (post-`db:reset`), Phase 1 may write little because there's nothing to update; Phase 2 will produce a baseline assessment from sparse inputs. This is fine for verifying the wiring. To get a realistic dry-run, pre-seed the local DB by importing a few real rows from the linked project first.

If the cycle fails, the error message and `error_phase` tell you which phase to debug.

- [ ] **Step 5: Commit**

```bash
git add scripts/pipeline-smoke.ts package.json package-lock.json
git commit -m "feat(pipeline): manual smoke test script for end-to-end validation"
```

---

## Task 28: Deploy and verify production cron

**Files:** none (deploy + verification only)

- [ ] **Step 1: Confirm migrations and code on `main`**

Run: `git status && git log --oneline -10`
Expected: clean working tree, commits in order from Tasks 1–27.

- [ ] **Step 2: Push migrations to linked Supabase project**

Run: `supabase db push --linked`
Expected: 4 new migrations apply cleanly to production. Confirm:

```bash
supabase db query "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='case_relationships';" --linked
```

Expected: 1 row.

- [ ] **Step 3: Deploy to Vercel**

Run: `vercel --prod`
Expected: build succeeds. The `crons` entry registers automatically.

- [ ] **Step 4: Manually trigger the cron route once to confirm production wiring**

Get the production `CRON_SECRET` from Vercel:

```bash
vercel env pull .env.production.local --environment=production
grep ^CRON_SECRET= .env.production.local
```

Then run the curl with the literal value substituted:

```bash
curl -X POST -H "Authorization: Bearer <PASTE_VALUE>" \
  "https://pathwatch-phi.vercel.app/api/cron/pipeline?disease=hantavirus"
```

Expected: JSON response with `ok: true`, `delta`, `threat_written: true`, `total_cost_usd: ~1.0`. Takes 5–10 minutes.

When done, delete `.env.production.local` so the secret isn't sitting on disk.

- [ ] **Step 5: Verify via dashboard + scrape_log**

Open https://pathwatch-phi.vercel.app — assessment timestamp should be very recent ("a few minutes ago"), and:

```bash
supabase db query "SELECT created_at, events_created, threat_written, snapshot_written, total_cost_usd, error FROM scrape_log ORDER BY created_at DESC LIMIT 3;" --linked
```

Expected: most-recent row has the manual trigger's stats, no error.

- [ ] **Step 6: Wait for the next scheduled cron**

The next 6-hour boundary (00, 06, 12, 18 UTC) will fire automatically. After it fires, repeat the scrape_log query — a second row should appear. That confirms the cron itself is live.

- [ ] **Step 7: Confirm dispatch session stays disabled**

The local Anthropic-hosted scheduled task should remain disabled now that the Vercel cron is the source of truth. Verify:

```bash
grep -A1 '"id": "pathwatch-pipeline"' "/Users/claude/Library/Application Support/Claude/local-agent-mode-sessions/3298f7f7-0d97-4121-967e-0d5c8dee4c80/1974a476-bb45-464f-af0e-2fdcceee8eb7/scheduled-tasks.json" | grep enabled
```

Expected: `"enabled": false`. If `true`, edit the file to set `false` (otherwise both pipelines will run, doubling spend and creating duplicate writes).

- [ ] **Step 8: No commit needed; this task is verification only**

If anything in the verification fails, do NOT mark this task complete. Diagnose via Vercel logs (`vercel logs --prod --follow`) and the `error` / `error_phase` columns in `scrape_log`.

---

## Self-review notes

- All four migrations from spec §3 covered (Tasks 4–7)
- All 17 file paths from `lib/pipeline/` mapped to tasks
- Output coverage: every UI surface in spec §2 has a tool/phase that writes its underlying table (Tasks 11–22)
- TDD pattern (failing test → implementation → passing test → commit) applied to every tool and to auth + log
- No `<TS>` placeholders — concrete migration timestamps `2026050912/13/14/15 0000`
- AI SDK API caveats noted explicitly in Tasks 21 and 22 with verification instructions, since exact options vary by minor version
- Smoke test exercises real Anthropic + real Polymarket once, locally, before any production deploy
- Task 28 is verification-only with explicit failure-path instructions ("do NOT mark complete; diagnose via …")
