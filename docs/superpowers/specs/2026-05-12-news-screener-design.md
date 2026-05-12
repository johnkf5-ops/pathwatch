# Live News Screener — Design Spec

**Status:** Designed 2026-05-12 in conversation brainstorm. Pending implementation plan.
**Author:** Claude (operator session)
**Trigger:** Dashboard needs to feel constantly active to retain visitors between pipeline cycles (currently run ~2x/day by the operator). LLM-based "live agent" options were rejected on cost; raw news aggregation was rejected on noise. This is the threading-the-needle design.

---

## Goal

A live news ticker at the top of the dashboard that pulls headlines from credible sources only, rotates them continuously so there's always motion, and interrupts the rotation with a `BREAKING` badge when a genuinely fresh item lands. Costs ~$0 to run. Doesn't depend on the pipeline being active.

## Why this exists

Between pipeline cycles, the dashboard has no fresh content arriving in real time. The EventFeed shows the pipeline's curated output but doesn't move when the pipeline is dormant. Visitors arriving during the 10+ hour gaps between cycles see a static-looking page. The news screener creates continuous motion using public news data the pipeline would already check, but on a shorter cadence (every 15 min vs. 2x/day) and without the write-time rigor overhead.

The screener and the EventFeed have distinct roles:

- **News screener (top of dashboard)** — raw incoming news, clickable links, filtered only by source credibility. Pure visibility surface.
- **EventFeed (bottom of dashboard)** — curated, fact-checked, verbatim-quoted events written by the pipeline with full agent_notes and tag treatment.

The asymmetry is honest: *"this is what's circulating in trusted outlets; here's what we've verified."*

---

## Architecture

### Data source

Vercel cron polls Google News RSS every 15 minutes with multiple queries:

- `site:who.int hantavirus`
- `site:cdc.gov hantavirus`
- ... one per credibility-tier-1-2 domain
- Plus broad queries scoped to the cluster: `"MV Hondius"`, `"Andes virus"`, `"hantavirus 2026"`

Google News RSS is free, no auth, no rate limit at this volume. Fetch is server-side (Vercel Function) to dodge CORS. Each headline is deduped by URL hash, filtered to `published_at` within last 72 hours, and INSERTed into a new `news_log` table.

### Credible-source allowlist (~15 domains)

Confirm and tune in the implementation plan. Starting list:

- **Health authorities (Tier 1):** `who.int`, `cdc.gov`, `ecdc.europa.eu`, `africacdc.org`, `ukhsa.gov.uk`, `rivm.nl`, `rki.de`, `bag.admin.ch`
- **Wire services (Tier 1-2):** `reuters.com`, `apnews.com`
- **Major broadcasters (Tier 2):** `bbc.com`, `cnn.com`, `nbcnews.com`, `abcnews.go.com`, `npr.org`
- **Quality print (Tier 2-3):** `nytimes.com`, `washingtonpost.com`, `theguardian.com`

Note: matches the credibility-tier convention already in `docs/runbooks/pipeline.md`. Tier 3-4 outlets (tabloids, popular press, regional) are explicitly excluded — they're the source of the noise that killed the loose-filter design.

### Schema

New table `news_log`:

```sql
CREATE TABLE news_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  source_domain TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  url_hash TEXT GENERATED ALWAYS AS (md5(url)) STORED,
  query_term TEXT,
  disease TEXT NOT NULL DEFAULT 'hantavirus',
  CONSTRAINT news_log_url_hash_unique UNIQUE (url_hash)
);

CREATE INDEX news_log_published_at_idx ON news_log (disease, published_at DESC);

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE news_log;

-- Public-read RLS (same pattern as events / cases / country_stats)
ALTER TABLE news_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY news_log_public_read ON news_log FOR SELECT USING (true);
```

### Server-side fetcher

`/api/news-screener/cron` — Vercel cron route, scheduled every 15 min via `vercel.ts`:

```ts
// vercel.ts (approximate)
export const config = {
  crons: [{ path: '/api/news-screener/cron', schedule: '*/15 * * * *' }],
};
```

The route:
1. For each query in the source × keyword matrix, fetch Google News RSS.
2. Parse RSS via `fast-xml-parser` (already a transitive dep, or add).
3. Extract `title`, `link`, `pubDate`, `source` for each item.
4. Deduplicate by URL.
5. Filter: drop items older than 72 hours, drop domains not in the allowlist.
6. INSERT into `news_log` ON CONFLICT DO NOTHING (the unique URL hash absorbs dupes).
7. Return a summary (count fetched, count INSERTed) for logging.

Failure modes:
- RSS fetch fails → log to `scrape_log` (source_type='news_screener'), skip query, continue.
- All queries fail → cycle is a no-op, no new INSERTs, ticker keeps rotating existing rows.

### Client component

New `<NewsScreener />` component mounted between `<TopBar />` and the main grid in `app/DashboardClient.tsx`. ~32-40px tall, full-width, mono uppercase styling.

Behavior:

- **Initial load**: server-side fetch of last 72 hours from `news_log` (last 50 rows), passes to client as `initialNews`.
- **Realtime subscription**: subscribes to `news_log` INSERTs on the existing browser Supabase client.
- **Default state**: horizontal right-to-left scroll through the news pool. ~15px/sec. CSS-only animation (`@keyframes` translateX with negative duration), pause on hover.
- **On new INSERT**: if `published_at` is within last 10 minutes (genuinely fresh, not a late-arriving 2-hour-old story), trigger the BREAKING interrupt:
  1. Pause the scroll animation.
  2. Prepend the new item to the rendered list with a red `BREAKING` badge.
  3. Reset scroll position so the new item is at the leading (right) edge.
  4. Resume the scroll animation.
  5. After 10 minutes (or on next INSERT, whichever comes first), the `BREAKING` badge fades and the item joins normal rotation.
- **Click behavior**: each headline card is clickable → opens `url` in a new tab.

Item-card layout (each ~280px wide):

```
[●] SOURCE · 3m ago
Headline truncated at ~80 chars...
```

- `●` = source-domain favicon or generic dot
- Color treatment: items <1h old = bright text; older items = muted

### Hover and accessibility

- Pause scroll on hover for the whole strip.
- Keyboard tabbable: each card is a `<a>` with proper href.
- `prefers-reduced-motion: reduce` → static list, no scroll animation (mobile users and accessibility-conscious visitors get the news without the motion).

---

## Cost

- **Vercel cron**: free tier covers 1 cron per day on hobby. Pro tier ($20/mo, already in use for this project) covers any schedule. Cost negligible relative to existing plan.
- **Vercel Function invocations**: 96/day cron + ~50 client polls = ~5,000/month. Well within Pro tier 1M invocation/month allowance.
- **Supabase**: `news_log` table grows ~30-100 rows/day. Even at the upper bound, 36,500 rows/year. Free tier handles years of this.
- **No LLM cost**: nothing about this design involves a model.
- **No paid API**: Google News RSS is free; we don't touch NYT, WSJ, Bloomberg paid APIs.

Total marginal cost vs. current dashboard: $0.

---

## Non-goals (rejected during the brainstorm — do not relitigate)

### Not in scope: LLM-based "live agent"

Considered: a live-running small model (e.g., Claude Haiku 4.5) that does real web searches with reasoning visible to users. Rejected because (a) ~$5-15/day in token costs, (b) hallucination risk on a public dashboard, (c) duplicates the work the production pipeline already does. The EventFeed already shows what the pipeline curates.

### Not in scope: loose-filter news aggregation

Considered: pull from any source mentioning "hantavirus." Rejected because the result is dominated by tabloid clickbait, SEO spam, recycled background articles, and off-topic mentions. Undermines the dashboard's credibility — the whole point of the design rests on source quality.

### Not in scope: WHO/CDC-only filter

Considered: restrict the screener to top-tier health authorities only. Rejected because WHO publishes DONs ~weekly, CDC HAN ~monthly. Even at outbreak peak the volume is 3-10 items per week — not enough to fuel a streaming ticker. The ticker would mostly show stale entries. The ~15-domain Tier-1-and-Tier-2 allowlist is the volume floor.

### Not in scope: scrape_log strip

Considered: expose the existing `scrape_log` table as a ticker. Rejected because between pipeline cycles (10+ hour gaps at 2x/day cadence) the strip looks stale — last entry hours old. The news screener is independent of the pipeline cadence; it polls every 15 min regardless.

### Not in scope: AI summarization of headlines

Considered: route each headline through an LLM to generate a 1-sentence summary or significance score. Rejected because (a) adds cost, (b) hallucination risk, (c) doesn't add value over a clickable raw link. The screener's job is surfacing, not interpreting.

### Not in scope: schema changes beyond the new news_log table

The screener is self-contained. It does not change `events`, `cases`, `country_stats`, `snapshots`, `threat_assessments`, or anything else. The EventFeed continues to work as it does. The news_log is a parallel, additive data surface.

### Not in scope: write-time rigor rules on news_log entries

The screener does not apply Rule A (verbatim quote), Rule A.2 (primary-source vs paraphrased), Rule B (opposing-search), Rule C (re-verify), Rule D (follow-up channels). Those rules govern what enters the curated EventFeed via the pipeline. News_log entries are raw incoming links — no verification claims attached. The visual treatment makes this clear (no significance score, no agent_notes, no fact-check tag).

---

## Optional companion: motion-design layer

Worth shipping in the same window as the screener for compounding effect, but technically independent. All pure client-side, $0, no new data dependency.

1. **Auto-scrolling EventFeed** — the existing bottom ticker doesn't auto-advance today. Add slow horizontal scroll with pause-on-hover. Same animation pattern as the news screener.
2. **Live "X ago" counters** on every event card, case status row, snapshot timestamp. Pure `setInterval`, ticks every second. Adds motion across the whole page.
3. **Map marker breathing** — CSS `@keyframes` on death markers (red, slow pulse) and active country fills. Pure decoration, no compute cost.
4. **Polymarket auto-refresh every 60s** — client-side fetch from `gamma-api.polymarket.com`, animate the numbers ticking between values. Real data, real motion, no server cost.

These four together create the always-alive feel using existing data. The news screener creates the constant fresh-news feel using new data. Together they make the dashboard feel like an active flight deck.

The implementation plan should treat these as separate tasks within the same sub-project — they can ship independently or together.

---

## Acceptance criteria

Implementation is complete when:

- `news_log` table exists in remote prod with RLS public-read and Realtime publication.
- Vercel cron is configured for `/api/news-screener/cron` running every 15 minutes.
- Cron fetch successfully writes ~5-30 rows on first run (depends on what's published in last 72h).
- Dashboard renders the news screener strip between TopBar and the main grid.
- Strip auto-scrolls right-to-left at ~15px/sec, pauses on hover.
- Headlines are clickable; click opens source URL in new tab.
- A new INSERT to news_log with recent `published_at` triggers the BREAKING badge and scroll reset behavior, observed live during testing.
- Source allowlist correctly excludes off-list domains (test by manually triggering a fetch from a non-allowed domain and confirming it's filtered).
- Mobile viewport renders the strip cleanly (no horizontal overflow of the page; strip itself scrolls within the viewport width).
- `prefers-reduced-motion` users get a static list instead of an animated scroll.

---

## Decisions log

| Decision | Choice | Why |
|---|---|---|
| Data source for headlines | Google News RSS with `site:` filters | Free, no auth, no rate limit at this volume; consistent format across queries; broad domain support |
| Polling cadence | Every 15 minutes via Vercel cron | Fast enough for "breaking news" to land within ~15 min of publication; slow enough to fit in free-tier function quotas |
| Filtering | Domain allowlist (~15 Tier-1-2 sources) + 72h published_at window | Tighter filtering creates emptiness; looser creates junk; this is the threading-the-needle volume |
| Schema | New `news_log` table, no changes to existing tables | Self-contained; doesn't entangle with pipeline write rules or EventFeed |
| BREAKING badge trigger | `published_at` within last 10 min on Realtime INSERT | Filters out late-arriving older stories that get backfilled into the feed; preserves the badge for genuinely fresh material |
| Display position | Above main grid, below TopBar | Top-of-attention placement; visually distinct from the bottom EventFeed strip |
| LLM involvement | None | Cost, hallucination risk, complexity — and EventFeed already handles interpretation |
| Companion motion-design layer | Spec separately, ship together | The screener handles "new content arrival"; motion design handles "ambient activity" — different problems, both worth solving |

---

## Implementation framing for writing-plans

This is a moderately-sized patch:

- **Files modified:** `app/DashboardClient.tsx`, `app/page.tsx` (data fetch), `lib/types.ts` (NewsLogEntry type), `vercel.ts` (cron config — or `vercel.json`)
- **Files created:** `app/api/news-screener/cron/route.ts` (cron handler), `components/news/NewsScreener.tsx` (the strip), `lib/news-screener-sources.ts` (the allowlist + query matrix), and one migration `supabase/migrations/<ts>_news_log.sql`
- **Schema changes:** 1 new table (`news_log`)
- **Environment changes:** Vercel cron configured. May need `CRON_SECRET` env var for cron-route auth (standard Vercel pattern).
- **No frontend functional changes to existing surfaces** — the screener is purely additive
- **No test additions** — per existing project convention, verification is operator-on-sight + first-cron-run smoke

Suggested task decomposition for the implementation plan:

1. Migration: create `news_log` table with RLS + Realtime
2. Type: add `NewsLogEntry` to `lib/types.ts`
3. Allowlist module: `lib/news-screener-sources.ts` with the ~15 domain list + query matrix
4. Cron API route: `app/api/news-screener/cron/route.ts` — fetch Google News RSS per query, parse, filter, dedupe, insert
5. Vercel cron config: schedule the route every 15 min
6. Server-side initial fetch: `app/page.tsx` adds `news_log` to the parallel fetch block, passes to `DashboardClient`
7. NewsScreener component: `components/news/NewsScreener.tsx` — auto-scrolling strip, Realtime subscribe, BREAKING badge logic
8. Mount in `DashboardClient.tsx` between TopBar and main grid
9. Apply migration to remote prod via `supabase db push --linked`
10. First-cron-run smoke: trigger the cron route manually, confirm rows appear in `news_log` and stream onto the dashboard

The companion motion-design tasks (auto-scroll EventFeed, live "X ago" counters, map marker breathing, Polymarket auto-refresh) can be added as sibling tasks 11-14 or split into a separate plan.

When picking this up: invoke `superpowers:writing-plans` to convert this spec into a task-by-task plan. Each row in §Implementation framing above maps to one or two Edit/Bash/Write steps.
