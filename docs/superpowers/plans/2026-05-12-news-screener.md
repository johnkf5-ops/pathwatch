# Live News Screener Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live news ticker between the TopBar and the main dashboard grid that surfaces credible-source headlines on continuous horizontal rotation and interrupts with a `BREAKING` badge when a fresh item lands via Supabase Realtime.

**Architecture:** New `news_log` Supabase table (public-read RLS, no public insert, in `supabase_realtime` publication). A Vercel cron route (`/api/news-screener/cron`, every 15 min) fetches Google News RSS for ~8 site-scoped + broad queries, parses with `fast-xml-parser`, filters by domain allowlist and 72-hour `published_at` window, and inserts via Supabase service-role key. The Next.js page server-fetches the last 50 rows and passes them to `<DashboardClient>`; a new `<NewsScreener>` component renders a CSS-animated horizontal strip, subscribes to `news_log` INSERTs, and prepends fresh items (`published_at` within the last 10 min) with a `BREAKING` badge that auto-fades.

**Tech Stack:** Next.js 14 App Router (TypeScript, strict), Supabase Postgres + Realtime + RLS, Vercel cron (configured via `vercel.json`), `fast-xml-parser` for RSS parsing, Tailwind (intel-terminal palette), Playwright smoke tests. No LLM involvement. ~$0 marginal cost.

**Spec:** `docs/superpowers/specs/2026-05-12-news-screener-design.md`. Decisions log there is authoritative — this plan does not relitigate rejected options (LLM agent, loose-filter aggregation, scrape_log strip).

**Environment additions:**
- `CRON_SECRET` — random 32+ char string. Vercel cron sends `Authorization: Bearer <CRON_SECRET>`; the route 401s on mismatch. Add to Vercel project env (Preview + Production). Add to `.env.local` for local manual testing.
- `SUPABASE_SERVICE_ROLE_KEY` — already provisioned on Vercel (used by the pipeline-related rebuild specs) but currently not consumed in the Next.js app. The cron route is the first consumer; the env var is read inside the route handler only. Add to `.env.local` (value from Supabase dashboard → Settings → API → service_role).

---

## File Structure

**New files:**
- `supabase/migrations/20260512000000_news_log.sql` — `news_log` table, indexes, RLS (public read only), realtime publication add.
- `lib/news-screener-sources.ts` — `ALLOWED_DOMAINS` set + `QUERY_MATRIX` constant. Pure data, no logic.
- `lib/news-screener-fetch.ts` — pure functions: `extractDomain(url)`, `parseRssFeed(xml)`, `filterItems(items, { allowedDomains, maxAgeHours })`, `buildGoogleNewsUrl(query)`. Unit-testable.
- `app/api/news-screener/cron/route.ts` — `GET` handler. Bearer-auth, iterates query matrix, fetches, parses, filters, inserts with `onConflict: 'url_hash'`. Returns JSON summary.
- `components/news/NewsScreener.tsx` — client component. Renders the strip; subscribes to `news_log` INSERTs; manages BREAKING state.

**Modified files:**
- `lib/types.ts` — append `NewsLogEntry` interface.
- `app/page.tsx` — add `news_log` to the parallel fetch block; pass `initialNews` prop.
- `app/DashboardClient.tsx` — accept `initialNews`; mount `<NewsScreener />` between `<TopBar />` and the layout split.
- `app/globals.css` — add `@keyframes scroll-news` plus `.news-screener-track` utility class + `@media (prefers-reduced-motion: reduce)` override.
- `vercel.json` — add `crons` entry pointing at `/api/news-screener/cron` on `*/15 * * * *`.
- `supabase/seed.sql` — append ~4 seed `news_log` rows so local dev renders content.
- `package.json` — add `fast-xml-parser` as a direct dependency (currently only a transitive). Add `iconv-lite` is NOT needed.
- `tests/dashboard.spec.ts` — append one test asserting the NewsScreener strip renders with seeded titles.

**Schema changes:** 1 new table (`news_log`). No changes to existing tables.

**No removed files. No changes to EventFeed, MapPane, KpiHud, or any existing surface.**

---

## Task 1: Add `fast-xml-parser` as a direct dependency

**Files:**
- Modify: `package.json`

The parser is currently a transitive dep at v5.7.3. Promoting it to a direct dep makes the import explicit and survives future tree-shaking.

- [ ] **Step 1: Add the dep**

```bash
npm install fast-xml-parser@^5.7.3
```

Expected: `package.json` and `package-lock.json` updated; existing transitive copy reused (no extra install size).

- [ ] **Step 2: Verify import works**

```bash
node -e "const { XMLParser } = require('fast-xml-parser'); console.log(typeof XMLParser);"
```

Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add fast-xml-parser as direct dep for news screener RSS parsing"
```

---

## Task 2: Create `news_log` migration

**Files:**
- Create: `supabase/migrations/20260512000000_news_log.sql`

- [ ] **Step 1: Confirm table does not yet exist locally**

Run:
```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "\dt news_log" 2>&1 | head -5
```
Expected: `Did not find any relation named "news_log".` (If supabase isn't running locally, run `npx supabase start` first.)

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260512000000_news_log.sql`:

```sql
-- news_log — credible-source headlines pulled by /api/news-screener/cron every
-- 15 min. Public-read; no public insert (writes use the service role key).
-- See docs/superpowers/specs/2026-05-12-news-screener-design.md.

CREATE TABLE news_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fetched_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  published_at TIMESTAMPTZ,
  source_domain TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  url_hash TEXT GENERATED ALWAYS AS (md5(url)) STORED,
  query_term TEXT,
  disease TEXT DEFAULT 'hantavirus' NOT NULL
);

CREATE UNIQUE INDEX idx_news_log_url_hash ON news_log (url_hash);
CREATE INDEX idx_news_log_disease_published_at
  ON news_log (disease, published_at DESC NULLS LAST);

ALTER TABLE news_log ENABLE ROW LEVEL SECURITY;

-- Anonymous read; writes go through the service role key in the cron route.
CREATE POLICY news_log_public_read ON news_log FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE news_log;

COMMENT ON TABLE news_log IS
  'Credible-source news headlines surfaced in the dashboard NewsScreener strip. '
  'Inserted by /api/news-screener/cron; deduped by url_hash; filtered to ~15 '
  'allowed domains and a 72h published_at window.';
```

- [ ] **Step 3: Apply locally**

Run: `npm run db:reset`
Expected: succeeds; no migration errors.

- [ ] **Step 4: Verify table exists with the right shape**

Run:
```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "\d news_log"
```

Expected: shows columns `id`, `fetched_at`, `published_at`, `source_domain`, `title`, `url`, `url_hash` (generated stored), `query_term`, `disease`; unique index on `url_hash`; check that RLS is enabled (run `\d+ news_log` — should show `Policy news_log_public_read`).

- [ ] **Step 5: Verify realtime publication includes news_log**

Run:
```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'news_log';"
```

Expected: returns one row containing `news_log`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260512000000_news_log.sql
git commit -m "Add news_log table for live news screener (RLS public-read + realtime)"
```

---

## Task 3: Add `NewsLogEntry` type

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Append to `lib/types.ts`**

After the existing `ThreatAssessment` interface (the file's last block, around line 224), add:

```ts
export interface NewsLogEntry {
  id: string;
  fetched_at: string;
  published_at: string | null;
  source_domain: string;
  title: string;
  url: string;
  url_hash: string;
  query_term: string | null;
  disease: string;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no type errors).

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "Add NewsLogEntry type for news screener"
```

---

## Task 4: Build the source allowlist + query matrix module

**Files:**
- Create: `lib/news-screener-sources.ts`

- [ ] **Step 1: Write the module**

```ts
// lib/news-screener-sources.ts
//
// Credible-source allowlist + Google News query matrix for the news screener
// cron. Tier-1-2 sources only (health authorities + wire services + major
// broadcasters + quality print). Tier-3-4 outlets are excluded by design —
// see docs/superpowers/specs/2026-05-12-news-screener-design.md.

export const ALLOWED_DOMAINS: ReadonlySet<string> = new Set([
  // Health authorities (Tier 1)
  'who.int',
  'cdc.gov',
  'ecdc.europa.eu',
  'africacdc.org',
  'ukhsa.gov.uk',
  'rivm.nl',
  'rki.de',
  'bag.admin.ch',
  // Wire services (Tier 1-2)
  'reuters.com',
  'apnews.com',
  // Major broadcasters (Tier 2)
  'bbc.com',
  'bbc.co.uk',
  'cnn.com',
  'nbcnews.com',
  'abcnews.go.com',
  'npr.org',
  // Quality print (Tier 2-3)
  'nytimes.com',
  'washingtonpost.com',
  'theguardian.com',
]);

// Each entry produces one Google News RSS fetch. Site-scoped queries pull
// from authority domains directly; broad cluster queries pull from anywhere
// (and get filtered against ALLOWED_DOMAINS post-fetch).
export const QUERY_MATRIX: ReadonlyArray<string> = [
  // Site-scoped authority queries
  'site:who.int hantavirus',
  'site:cdc.gov hantavirus',
  'site:ecdc.europa.eu hantavirus',
  'site:reuters.com hantavirus',
  'site:apnews.com hantavirus',
  // Broad cluster queries (allowlist filter does the heavy lifting)
  '"MV Hondius" hantavirus',
  '"Andes virus"',
  'hantavirus 2026',
];
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/news-screener-sources.ts
git commit -m "Add news screener domain allowlist and query matrix"
```

---

## Task 5: Build the pure RSS-fetch helpers

**Files:**
- Create: `lib/news-screener-fetch.ts`

These are server-only pure functions that the cron route composes. No Supabase, no `fetch` — caller wires those in. Pure makes future testing easy and the cron route trivial.

- [ ] **Step 1: Write the module**

```ts
// lib/news-screener-fetch.ts
//
// Pure helpers for the news screener cron. Caller supplies fetch + supabase
// client; this module only knows how to build URLs, parse RSS, and filter.

import { XMLParser } from 'fast-xml-parser';

export interface RawNewsItem {
  title: string;
  url: string;
  published_at: string | null;
  source_domain: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

export function buildGoogleNewsUrl(query: string): string {
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}

export function extractDomain(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

// Google News RSS wraps the publisher URL with a news.google.com redirect.
// The publisher domain is exposed in the <source url="..."> element on each
// item. Fall back to extracting from the <link> if the source attr is absent.
export function parseRssFeed(xml: string): RawNewsItem[] {
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: unknown } };
  };
  const itemsRaw = parsed.rss?.channel?.item;
  if (!itemsRaw) return [];
  const items = Array.isArray(itemsRaw) ? itemsRaw : [itemsRaw];

  const out: RawNewsItem[] = [];
  for (const it of items) {
    const item = it as Record<string, unknown>;
    const title = typeof item.title === 'string' ? item.title : null;
    const link = typeof item.link === 'string' ? item.link : null;
    const pubDate = typeof item.pubDate === 'string' ? item.pubDate : null;
    const sourceField = item.source as Record<string, unknown> | string | undefined;
    let sourceUrlAttr: string | null = null;
    if (sourceField && typeof sourceField === 'object') {
      sourceUrlAttr = typeof sourceField['@_url'] === 'string'
        ? (sourceField['@_url'] as string)
        : null;
    }

    if (!title || !link) continue;
    const domain = extractDomain(sourceUrlAttr ?? link);
    if (!domain) continue;

    const published_at = pubDate ? new Date(pubDate).toISOString() : null;
    out.push({ title, url: link, published_at, source_domain: domain });
  }
  return out;
}

export function filterItems(
  items: RawNewsItem[],
  opts: { allowedDomains: ReadonlySet<string>; maxAgeHours: number; now?: Date },
): RawNewsItem[] {
  const now = (opts.now ?? new Date()).getTime();
  const maxAgeMs = opts.maxAgeHours * 60 * 60 * 1000;
  return items.filter((it) => {
    if (!opts.allowedDomains.has(it.source_domain)) return false;
    if (it.published_at == null) return false; // require a real pubDate
    const age = now - new Date(it.published_at).getTime();
    return age >= 0 && age <= maxAgeMs;
  });
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Smoke-test the parser against a known fixture**

Run (one-liner against the parser):

```bash
node -e "
const { parseRssFeed, filterItems, extractDomain } = require('./lib/news-screener-fetch.ts');
console.log('skip-ts');
" 2>&1 | head -5
```

(This will fail because Node can't run TS directly — fine.) Instead verify by importing from a quick scratch tsx file:

```bash
cat > /tmp/news-smoke.mjs <<'EOF'
import { parseRssFeed, filterItems, extractDomain } from './lib/news-screener-fetch.ts';
const xml = `<?xml version="1.0"?><rss><channel><item><title>WHO confirms hantavirus cluster</title><link>https://www.who.int/article-1</link><pubDate>${new Date().toUTCString()}</pubDate><source url="https://www.who.int">WHO</source></item><item><title>Tabloid clickbait</title><link>https://example-tabloid.com/x</link><pubDate>${new Date().toUTCString()}</pubDate><source url="https://example-tabloid.com">X</source></item></channel></rss>`;
const items = parseRssFeed(xml);
console.log('parsed', items.length);
console.log('domains', items.map(i => i.source_domain));
EOF
```

Then verify by manually calling `extractDomain` in the route route — skip a strict unit-test step. The parser correctness will be verified end-to-end in Task 11 (curl-the-cron).

- [ ] **Step 4: Commit**

```bash
git add lib/news-screener-fetch.ts
git commit -m "Add news screener fetch/parse/filter pure helpers"
```

---

## Task 6: Cron API route — write the handler

**Files:**
- Create: `app/api/news-screener/cron/route.ts`

- [ ] **Step 1: Write the handler**

```ts
// app/api/news-screener/cron/route.ts
//
// Vercel cron entry point — runs every 15 minutes (see vercel.json).
// Fetches Google News RSS for every query in QUERY_MATRIX, parses, filters
// against ALLOWED_DOMAINS, and inserts unique rows into news_log via
// the Supabase service-role key. Returns a JSON summary.
//
// Auth: requires header `Authorization: Bearer ${CRON_SECRET}`. Vercel cron
// automatically injects this; manual curl must supply it.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  buildGoogleNewsUrl,
  parseRssFeed,
  filterItems,
  type RawNewsItem,
} from '@/lib/news-screener-fetch';
import { ALLOWED_DOMAINS, QUERY_MATRIX } from '@/lib/news-screener-sources';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

interface CycleSummary {
  ok: boolean;
  queries: number;
  fetched: number;
  filtered: number;
  inserted: number;
  errors: string[];
}

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET not configured' },
      { status: 500 },
    );
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: 'Supabase env vars missing' },
      { status: 500 },
    );
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const summary: CycleSummary = {
    ok: true,
    queries: QUERY_MATRIX.length,
    fetched: 0,
    filtered: 0,
    inserted: 0,
    errors: [],
  };

  // Accumulate across queries, dedupe by URL before insert.
  const seen = new Map<string, RawNewsItem & { query_term: string }>();

  for (const query of QUERY_MATRIX) {
    try {
      const res = await fetch(buildGoogleNewsUrl(query), {
        headers: { 'user-agent': 'Pathwatch/1.0 (news-screener cron)' },
        cache: 'no-store',
      });
      if (!res.ok) {
        summary.errors.push(`fetch ${query}: HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const parsed = parseRssFeed(xml);
      summary.fetched += parsed.length;
      const filtered = filterItems(parsed, {
        allowedDomains: ALLOWED_DOMAINS,
        maxAgeHours: 72,
      });
      summary.filtered += filtered.length;
      for (const item of filtered) {
        if (!seen.has(item.url)) {
          seen.set(item.url, { ...item, query_term: query });
        }
      }
    } catch (err) {
      summary.errors.push(`fetch ${query}: ${(err as Error).message}`);
    }
  }

  if (seen.size > 0) {
    const rows = Array.from(seen.values()).map((it) => ({
      title: it.title,
      url: it.url,
      published_at: it.published_at,
      source_domain: it.source_domain,
      query_term: it.query_term,
      disease: 'hantavirus',
    }));
    // url_hash is GENERATED — Postgres computes it. Upsert on url_hash so a
    // duplicate URL (e.g. re-fetched on a later cycle) is a no-op.
    const { error, count } = await supabase
      .from('news_log')
      .upsert(rows, { onConflict: 'url_hash', ignoreDuplicates: true, count: 'exact' });
    if (error) {
      summary.ok = false;
      summary.errors.push(`upsert: ${error.message}`);
    } else {
      summary.inserted = count ?? 0;
    }
  }

  return NextResponse.json(summary);
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/news-screener/cron/route.ts
git commit -m "Add /api/news-screener/cron route (fetch RSS, filter, insert)"
```

---

## Task 7: Add Vercel cron schedule

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Edit `vercel.json`**

Replace the current contents:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "crons": [
    { "path": "/api/news-screener/cron", "schedule": "*/15 * * * *" }
  ]
}
```

- [ ] **Step 2: Verify JSON is valid**

Run:
```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('vercel.json','utf8')).crons)"
```
Expected: one row showing `{ path: '/api/news-screener/cron', schedule: '*/15 * * * *' }`.

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "Schedule /api/news-screener/cron every 15 minutes"
```

---

## Task 8: Seed `news_log` rows for local development

**Files:**
- Modify: `supabase/seed.sql`

So `npm run dev` shows content in the strip without waiting for the cron.

- [ ] **Step 1: Append seed rows to `supabase/seed.sql`**

Append at the end of the file (after the monitoring cohort `INSERT INTO cases ...` block):

```sql
-- ============================================================
-- news_log seed (so the dashboard NewsScreener strip renders in dev)
-- Timestamps relative to seed time so items always appear "recent" in tests.
-- ============================================================
INSERT INTO news_log (published_at, source_domain, title, url, query_term, disease) VALUES
  (now() - interval '6 hours',  'who.int',       'WHO updates global risk assessment for MV Hondius hantavirus cluster',
    'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON599-update-1',
    'site:who.int hantavirus', 'hantavirus'),
  (now() - interval '14 hours', 'cdc.gov',       'CDC updates HAN advisory; active monitoring continues for MV Hondius returnees',
    'https://www.cdc.gov/han/han00528.html',
    'site:cdc.gov hantavirus', 'hantavirus'),
  (now() - interval '22 hours', 'reuters.com',   'Cape Verde port closure extended as MV Hondius evacuation continues',
    'https://www.reuters.com/world/africa/cape-verde-mv-hondius-2026-05-11',
    '"MV Hondius" hantavirus', 'hantavirus'),
  (now() - interval '32 hours', 'apnews.com',    'Andes virus: what we know about the only person-to-person hantavirus',
    'https://apnews.com/article/andes-virus-hantavirus-explainer-2026-05-11',
    '"Andes virus"', 'hantavirus'),
  (now() - interval '48 hours', 'bbc.com',       'Swiss confirm secondary hantavirus case linked to MV Hondius returnee',
    'https://www.bbc.com/news/health-2026-05-10',
    'hantavirus 2026', 'hantavirus');
```

- [ ] **Step 2: Reset DB and verify seed rows**

Run: `npm run db:reset`
Then:
```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "SELECT source_domain, title FROM news_log ORDER BY published_at DESC;"
```
Expected: 5 rows in descending `published_at` order.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "Seed news_log with 5 dev rows for NewsScreener strip"
```

---

## Task 9: Server-fetch news_log into the dashboard

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add `news_log` to the type import**

Edit `app/page.tsx` line 5–8 (`import type {...}` block) to add `NewsLogEntry`:

```ts
import type {
  Event, Snapshot, CountryStat, Case, CaseLocation, ThreatAssessment, Fact,
  OutbreakTimelineEntry, NewsLogEntry,
} from '@/lib/types';
```

- [ ] **Step 2: Add `news_log` to the parallel fetch block**

In `app/page.tsx` find the destructured `await Promise.all([ ... ])` (currently 9 entries ending at `timelineRes`). Add a 10th entry after `timelineRes`:

```ts
  const [
    snapshotRes,
    snapshotHistoryRes,
    eventsRes,
    countriesRes,
    casesRes,
    locationsRes,
    threatRes,
    factsRes,
    timelineRes,
    newsRes,
  ] = await Promise.all([
    // ... existing entries unchanged ...
    supabase
      .from('outbreak_timeline')
      .select('*')
      .eq('disease', 'hantavirus')
      .order('day_num', { ascending: false }),
    supabase
      .from('news_log')
      .select('*')
      .eq('disease', 'hantavirus')
      .gte('published_at', new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString())
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(50),
  ]);
```

- [ ] **Step 3: Pass `initialNews` to `<DashboardClient />`**

In the JSX return block of `app/page.tsx`, add a prop to `<DashboardClient ... />` after `initialTimeline`:

```tsx
        initialTimeline={(timelineRes.data as OutbreakTimelineEntry[] | null) ?? []}
        initialNews={(newsRes.data as NewsLogEntry[] | null) ?? []}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: FAIL with "Property 'initialNews' is missing" or similar — `DashboardClient` doesn't accept the prop yet. This is intentional; Task 10 wires it up.

- [ ] **Step 5: Do NOT commit yet**

Hold this change; Task 10 commits both files together.

---

## Task 10: Render `<NewsScreener />` inside `DashboardClient`

**Files:**
- Modify: `app/DashboardClient.tsx`

- [ ] **Step 1: Extend `Props` and add state + realtime subscription**

Edit `app/DashboardClient.tsx`:

(a) Add to the imports near the top (after `OutbreakTimelineEntry`):

```ts
import type {
  Event, Snapshot, CountryStat, Case, CaseLocation, ThreatAssessment, Fact,
  OutbreakTimelineEntry, NewsLogEntry,
} from '@/lib/types';
```

(b) Add `NewsScreener` import (near the other `@/components` imports):

```ts
import { NewsScreener } from '@/components/news/NewsScreener';
```

(c) Add `initialNews: NewsLogEntry[]` to the `Props` interface:

```ts
interface Props {
  initialSnapshot: Snapshot | null;
  initialSnapshotHistory: Snapshot[];
  initialEvents: Event[];
  initialCountries: CountryStat[];
  initialCases: Case[];
  initialCaseLocations: CaseLocation[];
  initialThreat: ThreatAssessment | null;
  initialFacts: Fact[];
  initialTimeline: OutbreakTimelineEntry[];
  initialNews: NewsLogEntry[];
}
```

(d) Destructure `initialNews` in the function signature and add a `news` state + sync effect, mirroring the existing pattern (after the `initialTimeline` state block, around line 61):

```ts
  const [news, setNews] = useState(initialNews);
  useEffect(() => { setNews(initialNews); }, [initialNews]);
```

(e) Inside the existing realtime `useEffect`, add a new channel after `ch7` (before the `return () => { ... removeChannel(ch7); }` block):

```ts
    const ch8 = supabase
      .channel('news-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'news_log', filter: 'disease=eq.hantavirus' },
        (p) => {
          const row = p.new as NewsLogEntry;
          setNews((prev) => (prev.find((n) => n.id === row.id) ? prev : [row, ...prev].slice(0, 80)));
        },
      )
      .subscribe();
```

And update the cleanup at the end of the effect to remove `ch8`:

```ts
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      supabase.removeChannel(ch3);
      supabase.removeChannel(ch4);
      supabase.removeChannel(ch5);
      supabase.removeChannel(ch6);
      supabase.removeChannel(ch7);
      supabase.removeChannel(ch8);
    };
```

(f) Mount the `<NewsScreener>` strip just after `<TopBar ... />` and before the mobile/desktop layout split. Find the line:

```tsx
      <TopBar snapshot={snapshot} threat={threat} monitoringCount={sumPersons(monitoringCases)} caseCount={sumPersons(caseRows)} />
```

Add immediately below it:

```tsx
      <NewsScreener items={news} />
```

- [ ] **Step 2: Typecheck (expected to fail because NewsScreener doesn't exist yet)**

Run: `npm run typecheck`
Expected: FAIL with "Cannot find module '@/components/news/NewsScreener'" — that's fine; Task 11 creates it.

- [ ] **Step 3: Do NOT commit yet**

Hold; Task 11 creates the component and commits both files (plus page.tsx from Task 9) together.

---

## Task 11: Build the `<NewsScreener />` component + CSS

**Files:**
- Create: `components/news/NewsScreener.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Add CSS keyframes + reduced-motion override**

Edit `app/globals.css`. Append at the end of the file:

```css
/* News screener — continuous right-to-left scroll. The track is duplicated
   in the component so the animation can loop with no visible jump. */
@keyframes scroll-news {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}

.news-screener-track {
  animation: scroll-news 90s linear infinite;
}
.news-screener-paused .news-screener-track,
.news-screener-track:hover {
  animation-play-state: paused;
}

@media (prefers-reduced-motion: reduce) {
  .news-screener-track {
    animation: none;
    transform: none;
  }
}
```

- [ ] **Step 2: Write the component**

Create `components/news/NewsScreener.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { Radio } from 'lucide-react';
import type { NewsLogEntry } from '@/lib/types';

const BREAKING_WINDOW_MS = 10 * 60 * 1000;

function isFresh(iso: string | null, now: number): boolean {
  if (!iso) return false;
  return now - new Date(iso).getTime() <= BREAKING_WINDOW_MS;
}

function ago(iso: string | null): string {
  if (!iso) return '';
  try {
    return formatDistanceToNowStrict(parseISO(iso)).toUpperCase();
  } catch {
    return '';
  }
}

interface ItemCardProps {
  item: NewsLogEntry;
  breaking: boolean;
}

function ItemCard({ item, breaking }: ItemCardProps) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-full shrink-0 items-center gap-2 border-r border-border px-3 font-mono text-[11px] uppercase tracking-[0.1em] text-text-secondary transition-colors hover:bg-surface-2 hover:text-text focus:outline-none focus:ring-1 focus:ring-green"
      title={item.title}
    >
      {breaking && (
        <span className="flex items-center gap-1 border border-red bg-red/10 px-1.5 py-0.5 text-[10px] font-semibold text-red">
          <Radio size={10} /> BREAKING
        </span>
      )}
      <span className="text-text-muted">{item.source_domain.toUpperCase()}</span>
      <span className="text-text-faint">·</span>
      <span className="text-text-muted">{ago(item.published_at)} AGO</span>
      <span className="text-text-faint">·</span>
      <span className="line-clamp-1 normal-case tracking-normal text-text">{item.title}</span>
    </a>
  );
}

export function NewsScreener({ items }: { items: NewsLogEntry[] }) {
  // Tick once a minute so "X AGO" labels stay accurate and the BREAKING
  // window expires without needing a fresh INSERT.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Sort newest first; cap at 60 to keep the rendered track short.
  const ordered = useMemo(() => {
    return [...items]
      .filter((it) => it.published_at != null)
      .sort((a, b) => {
        const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
        const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 60);
  }, [items]);

  if (ordered.length === 0) {
    // Empty-state: a static thin strip so the layout doesn't jump on first run.
    return (
      <div
        data-testid="news-screener"
        className="flex h-9 items-center border-b border-border bg-bg-2 px-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-muted"
      >
        AWAITING FIRST CREDIBLE-SOURCE HEADLINE…
      </div>
    );
  }

  // Render the items twice end-to-end so the CSS keyframe (translateX -50%)
  // loops seamlessly. `aria-hidden` on the duplicate keeps screen readers
  // sane.
  return (
    <div
      data-testid="news-screener"
      className="relative flex h-9 items-stretch overflow-hidden border-b border-border bg-bg-2"
    >
      <span
        className="flex shrink-0 items-center gap-1.5 border-r border-border bg-bg px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted"
        aria-hidden
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan" />
        NEWS WIRE
      </span>
      <div className="news-screener-track flex items-stretch whitespace-nowrap">
        {ordered.map((item) => (
          <ItemCard
            key={`a-${item.id}`}
            item={item}
            breaking={isFresh(item.published_at, now)}
          />
        ))}
        {ordered.map((item) => (
          <ItemCard
            key={`b-${item.id}`}
            item={item}
            breaking={isFresh(item.published_at, now)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck the full graph (now including page.tsx + DashboardClient.tsx from Tasks 9–10)**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Run smoke tests**

Run: `npm run test:smoke`
Expected: existing tests PASS (the strip's data-testid does not collide with existing test selectors).

- [ ] **Step 5: Visual sanity check**

Run: `npm run dev` and open `http://localhost:3000`.
Expected:
- A thin strip appears between the TopBar and the main grid.
- It shows `NEWS WIRE` label on the left followed by 5 seeded headlines.
- The strip auto-scrolls right-to-left.
- Hovering the strip pauses the scroll.
- Clicking a headline opens its URL in a new tab.
- None of the seed items show a `BREAKING` badge (all seeded `published_at` are ≥ 6h old, outside the 10-min window).

- [ ] **Step 6: Commit (combines Tasks 9, 10, 11)**

```bash
git add app/page.tsx app/DashboardClient.tsx app/globals.css components/news/NewsScreener.tsx
git commit -m "Render NewsScreener strip between TopBar and main grid"
```

---

## Task 12: Playwright smoke test for the strip

**Files:**
- Modify: `tests/dashboard.spec.ts`

- [ ] **Step 1: Append a test at the bottom of `tests/dashboard.spec.ts`**

```ts
test('NewsScreener strip renders seeded headlines', async ({ page }) => {
  await page.goto('/');
  const strip = page.getByTestId('news-screener').first();
  await expect(strip).toBeVisible();
  await expect(strip.getByText('NEWS WIRE')).toBeVisible();
  // Seed has WHO + CDC + Reuters + AP + BBC. At least one of them should
  // render in the strip — assert WHO since it's the most recent.
  await expect(
    strip.getByText(/WHO updates global risk assessment/i).first(),
  ).toBeVisible();
  // Domains render uppercase in the strip header for each card.
  await expect(strip.getByText('WHO.INT').first()).toBeVisible();
});
```

- [ ] **Step 2: Run the new test in isolation**

Run: `npx playwright test tests/dashboard.spec.ts -g "NewsScreener strip"`
Expected: PASS.

- [ ] **Step 3: Run the full smoke suite to confirm no regressions**

Run: `npm run test:smoke`
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/dashboard.spec.ts
git commit -m "Smoke test: NewsScreener strip renders seeded headlines"
```

---

## Task 13: Test the cron route locally end-to-end

**Files:** none (verification step only)

Validates the entire fetch → parse → filter → insert pipeline before pushing to Vercel.

- [ ] **Step 1: Add env vars to `.env.local`**

Open `.env.local`. Add (replace placeholder values):

```
CRON_SECRET=dev-local-cron-secret-rotate-in-prod
SUPABASE_SERVICE_ROLE_KEY=<paste service_role key from local supabase: `npx supabase status` → service_role key>
```

Get the local service-role key:

```bash
npx supabase status | grep service_role
```

Copy the printed key into `.env.local`.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev` (leave running in another terminal)

- [ ] **Step 3: Hit the cron route with correct auth**

Run:

```bash
curl -s -H "Authorization: Bearer dev-local-cron-secret-rotate-in-prod" \
  http://localhost:3000/api/news-screener/cron | jq .
```

Expected JSON shape (counts will vary based on what Google News returns):

```json
{
  "ok": true,
  "queries": 8,
  "fetched": <some integer ≥ 0>,
  "filtered": <some integer ≥ 0, ≤ fetched>,
  "inserted": <some integer ≥ 0>,
  "errors": []
}
```

- [ ] **Step 4: Verify auth rejection**

Run without the header:
```bash
curl -s -i http://localhost:3000/api/news-screener/cron | head -10
```
Expected: HTTP `401` with `{"ok":false,"error":"unauthorized"}`.

- [ ] **Step 5: Verify inserted rows in the local DB**

Run:
```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -c "SELECT source_domain, left(title,60) AS title, published_at FROM news_log ORDER BY fetched_at DESC LIMIT 20;"
```
Expected: rows include the 5 seeded entries plus whatever the cron just inserted. All `source_domain` values are in `ALLOWED_DOMAINS` (no off-list domains).

- [ ] **Step 6: Verify live realtime push**

With `npm run dev` still running and `http://localhost:3000` open in the browser, run the curl command again. Then in another shell, manually insert a row with `published_at = now()` to trigger the BREAKING badge:

```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c \
"INSERT INTO news_log (published_at, source_domain, title, url, query_term, disease) \
 VALUES (now(), 'reuters.com', 'BREAKING TEST: simulated fresh headline', \
 'https://www.reuters.com/breaking-test-' || extract(epoch from now())::bigint, 'manual-test', 'hantavirus');"
```

Expected: within ~2 seconds the new item appears at the leading edge of the strip in the browser with a red `BREAKING` badge. The badge will fade (disappear when component re-checks `isFresh()` on the next minute tick) after 10 minutes.

- [ ] **Step 7: No commit (verification only)**

Do not commit `.env.local` (it's in `.gitignore`).

---

## Task 14: Apply migration to remote prod + ship

**Files:** none (deploy step)

- [ ] **Step 1: Confirm `.env.local` is gitignored**

Run: `git status .env.local`
Expected: file untracked or ignored (no diff appears). If it appears tracked, stop and fix `.gitignore` first.

- [ ] **Step 2: Push the migration to the remote Supabase**

Run: `npx supabase db push --linked`
Expected: applies `20260512000000_news_log.sql`. Confirm with:
```bash
npx supabase db query --linked "SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='news_log';"
```
Expected: one row.

- [ ] **Step 3: Configure Vercel env vars**

In the Vercel dashboard (project: pathwatch) → Settings → Environment Variables, add for both Preview and Production:
- `CRON_SECRET` — generate via `openssl rand -hex 32`. Save the value; you'll need it for manual curls.
- `SUPABASE_SERVICE_ROLE_KEY` — copy from the Supabase project dashboard → Settings → API → service_role.

If both already exist (the service-role key may be present from a prior pipeline experiment), leave them.

- [ ] **Step 4: Push to main and let Vercel auto-deploy**

```bash
git push origin main
```

Wait for the Vercel deployment to finish (~2 min). Hard-refresh the production URL (`https://pathwatch-phi.vercel.app` and `https://hantavirustracer.com`) and confirm the strip renders. It may be empty until the first cron fires.

- [ ] **Step 5: Manually trigger the first cron on prod**

Run:
```bash
curl -s -H "Authorization: Bearer <prod CRON_SECRET>" \
  https://pathwatch-phi.vercel.app/api/news-screener/cron | jq .
```
Expected: `{ "ok": true, "inserted": <some integer ≥ 0>, ... }`.

- [ ] **Step 6: Verify rows in remote `news_log`**

Run:
```bash
npx supabase db query --linked "SELECT count(*), max(published_at) FROM news_log;"
```
Expected: count ≥ 1.

- [ ] **Step 7: Confirm scheduled cron is registered**

In the Vercel dashboard → Project → Crons, confirm `/api/news-screener/cron` is listed with schedule `*/15 * * * *` and the last invocation matches Step 5.

---

## Acceptance criteria recap (from spec)

After Task 14, all of these should be true:

- [x] `news_log` table exists in remote prod with public-read RLS and realtime publication. *(Tasks 2, 14)*
- [x] Vercel cron registered for `/api/news-screener/cron` every 15 min. *(Task 7, 14)*
- [x] Cron writes rows on first run. *(Task 14)*
- [x] Dashboard renders the NewsScreener strip between TopBar and main grid. *(Task 11)*
- [x] Strip auto-scrolls right-to-left and pauses on hover. *(Task 11 CSS)*
- [x] Headlines are clickable, open in a new tab. *(Task 11)*
- [x] Realtime INSERT with fresh `published_at` triggers `BREAKING` badge. *(Task 13 Step 6)*
- [x] Off-allowlist domains are filtered out. *(Task 5 + Task 13 Step 5 inspection)*
- [x] Mobile renders cleanly (strip itself horizontally scrolls within viewport). *(Task 11 — `overflow-hidden` on the strip container; full viewport width)*
- [x] `prefers-reduced-motion` users see a static list. *(Task 11 CSS)*

---

## Out of scope (do not implement in this plan)

These are listed in the spec as separate tasks; ship as siblings later:

- Auto-scrolling EventFeed bottom strip
- Live "X ago" counters on every event card (TimeAgo is already in use; broader audit not in this plan)
- Map marker breathing animations
- Polymarket 60s auto-refresh

Each can land as its own one-task PR.
