# Pathwatch Frontend 2c Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the final frontend cycle — `/event/[id]` detail page, dynamic OG images, GitHub + Vercel auto-deploy, light mobile polish — completing the V1 dashboard end-to-end.

**Architecture:** Detail page is a Server Component that fetches one event by id and a small related-events list. OG images are Next 14 `opengraph-image.tsx` files using `next/og`'s `ImageResponse`. Deploy is GitHub-driven: push to `main` → Vercel build hook → production.

**Tech Stack:** Next.js 14 (App Router), `next/og`, GitHub CLI (`gh`), Vercel CLI, existing 2a/2b stack.

**Spec:** `docs/superpowers/specs/2026-05-07-pathwatch-frontend-2c-design.md`

**Prerequisites (verify once before starting):**
- On `main` after sub-project 2b merge: `git log --oneline -1` shows the 2b merge.
- Local Supabase running with seeded data: `./scripts/reset-db.sh` succeeds.
- `npm run test:smoke` passes (2b baseline, 2 tests).
- `gh` CLI installed: `gh --version` → `gh version 2.x`.
- `vercel` CLI installed: `vercel --version` → `Vercel CLI 50.x`.
- Tasks 8–10 require **user-interactive auth** — see those tasks for the commands.

---

### Task 1: Wrap EventCard body in `<Link>`

**Files:**
- Modify: `components/feed/EventCard.tsx`

- [ ] **Step 1: Create the feature branch**

```bash
cd /Users/claude/Projects/project_contagion
git checkout -b feat/frontend-2c
```

- [ ] **Step 2: Replace `EventCard.tsx`**

Replace `/Users/claude/Projects/project_contagion/components/feed/EventCard.tsx`. Uses the
"stretched link" pattern: the Link wraps just the title, but its `::after` pseudo-element
covers the whole card. The Source link uses `relative z-10` to escape the cover. This avoids
nested anchors (invalid HTML) while keeping the entire card clickable.

```tsx
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { Event } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { SignificanceDot } from '@/components/ui/SignificanceDot';
import { CategoryPill } from '@/components/ui/CategoryPill';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { TimeAgo } from '@/components/ui/TimeAgo';
import { SourceIcon } from '@/components/ui/SourceIcon';

export function EventCard({ event }: { event: Event }) {
  return (
    <Card className="relative p-4 transition-colors hover:bg-surface-hover focus-within:ring-2 focus-within:ring-accent">
      <div className="mb-2 flex items-center gap-3">
        <SignificanceDot level={event.significance} />
        <SourceIcon source={event.source_type} />
        <TimeAgo iso={event.occurred_at ?? event.created_at} />
      </div>
      <h3 className="text-base font-semibold leading-snug text-text">
        <Link
          href={`/event/${event.id}`}
          className="after:absolute after:inset-0 after:content-[''] focus:outline-none"
        >
          {event.title}
        </Link>
      </h3>
      <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-text-secondary">{event.summary}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <CategoryPill category={event.category} />
        {event.country_code && (
          <span className="inline-flex items-center gap-1 text-text-secondary">
            <CountryFlag code={event.country_code} />
            <span>{event.location_name ?? event.country_code}</span>
          </span>
        )}
        {event.source_url && (
          <a
            href={event.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 ml-auto inline-flex items-center gap-1 text-accent hover:underline"
          >
            Source <ExternalLink size={12} />
          </a>
        )}
      </div>
    </Card>
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
git add components/feed/EventCard.tsx
git commit -m "$(cat <<'EOF'
Wrap EventCard in Link to /event/[id]

Whole card body now navigates to the detail page; the existing
Source link uses stopPropagation so it still opens externally
without intercepting the card click. Hover state and focus ring
added for keyboard navigation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Build `/event/[id]` page + EventDetail + RelatedEvents + not-found

**Files:**
- Create: `app/event/[id]/page.tsx`
- Create: `app/event/[id]/not-found.tsx`
- Create: `components/event/EventDetail.tsx`
- Create: `components/event/RelatedEvents.tsx`

- [ ] **Step 1: Write `EventDetail.tsx`**

Create `/Users/claude/Projects/project_contagion/components/event/EventDetail.tsx`:
```tsx
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { Event } from '@/lib/types';
import { SignificanceDot } from '@/components/ui/SignificanceDot';
import { SourceIcon } from '@/components/ui/SourceIcon';
import { TimeAgo } from '@/components/ui/TimeAgo';
import { CategoryPill } from '@/components/ui/CategoryPill';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { Badge } from '@/components/ui/Badge';
import { formatNumber } from '@/lib/format';
import { RelatedEvents } from './RelatedEvents';

export function EventDetail({ event, related }: { event: Event; related: Event[] }) {
  return (
    <main className="mx-auto max-w-[1100px] px-6 py-8">
      <Link href="/" className="mb-6 inline-block text-sm text-accent hover:underline">
        ← Back to dashboard
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <article>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <SignificanceDot level={event.significance} />
            <SourceIcon source={event.source_type} />
            <TimeAgo iso={event.occurred_at ?? event.created_at} />
            {event.is_verified && <Badge variant="outline">Verified</Badge>}
          </div>

          <h1 className="mb-4 text-3xl font-bold leading-tight text-text">{event.title}</h1>

          <p className="mb-6 text-base leading-relaxed text-text-secondary">{event.summary}</p>

          <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
            <CategoryPill category={event.category} />
            {event.country_code && (
              <span className="inline-flex items-center gap-1.5 text-text-secondary">
                <CountryFlag code={event.country_code} />
                <span>{event.location_name ?? event.country_code}</span>
              </span>
            )}
            {event.source_url && (
              <a
                href={event.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-accent hover:underline"
              >
                Source <ExternalLink size={14} />
              </a>
            )}
          </div>

          <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-border bg-surface p-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Cases</dt>
              <dd className="font-mono tabular-nums">{formatNumber(event.case_count)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Deaths</dt>
              <dd className="font-mono tabular-nums">{formatNumber(event.death_count)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Author</dt>
              <dd>{event.source_author ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Disease</dt>
              <dd className="capitalize">{event.disease}</dd>
            </div>
          </dl>

          {event.tags && event.tags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {event.tags.map((t) => (
                <Badge key={t} variant="outline">
                  #{t}
                </Badge>
              ))}
            </div>
          )}

          {event.raw_content && (
            <details className="rounded-xl border border-border bg-surface p-4">
              <summary className="cursor-pointer text-sm font-medium text-text">Raw source content</summary>
              <pre className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">
                {event.raw_content}
              </pre>
            </details>
          )}
        </article>

        <aside>
          <RelatedEvents events={related} />
        </aside>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write `RelatedEvents.tsx`**

Create `/Users/claude/Projects/project_contagion/components/event/RelatedEvents.tsx`:
```tsx
import Link from 'next/link';
import type { Event } from '@/lib/types';
import { SignificanceDot } from '@/components/ui/SignificanceDot';
import { SourceIcon } from '@/components/ui/SourceIcon';
import { TimeAgo } from '@/components/ui/TimeAgo';

export function RelatedEvents({ events }: { events: Event[] }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-text">Related events</h2>
      {events.length === 0 ? (
        <p className="text-xs text-text-muted">No related events yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/event/${e.id}`} className="block hover:bg-surface-hover -mx-2 rounded-md p-2">
                <div className="mb-1 flex items-center gap-2">
                  <SignificanceDot level={e.significance} />
                  <SourceIcon source={e.source_type} />
                  <TimeAgo iso={e.occurred_at ?? e.created_at} />
                </div>
                <p className="text-sm leading-snug text-text line-clamp-2">{e.title}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Write `not-found.tsx`**

Create `/Users/claude/Projects/project_contagion/app/event/[id]/not-found.tsx`:
```tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-[760px] px-6 py-16 text-center">
      <h1 className="mb-2 text-2xl font-semibold text-text">Event not found</h1>
      <p className="mb-6 text-sm text-text-secondary">
        That intelligence event doesn&apos;t exist, or it has been merged into another event as a duplicate.
      </p>
      <Link href="/" className="text-accent hover:underline">
        ← Back to dashboard
      </Link>
    </main>
  );
}
```

- [ ] **Step 4: Write `page.tsx`**

Create `/Users/claude/Projects/project_contagion/app/event/[id]/page.tsx`:
```tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase-server';
import { EventDetail } from '@/components/event/EventDetail';
import type { Event } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function fetchEvent(id: string): Promise<Event | null> {
  const supabase = createServerClient();
  const { data } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
  return (data as Event | null) ?? null;
}

async function fetchRelated(event: Event): Promise<Event[]> {
  const supabase = createServerClient();
  const filters: string[] = [`category.eq.${event.category}`];
  if (event.country_code) filters.push(`country_code.eq.${event.country_code}`);
  const { data } = await supabase
    .from('events')
    .select('*')
    .or(filters.join(','))
    .neq('id', event.id)
    .is('duplicate_of', null)
    .eq('disease', event.disease)
    .order('created_at', { ascending: false })
    .limit(5);
  return (data as Event[] | null) ?? [];
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const event = await fetchEvent(params.id);
  if (!event) return { title: 'Event not found — Pathwatch' };
  return {
    title: `${event.title} — Pathwatch`,
    description: event.summary,
    openGraph: {
      title: event.title,
      description: event.summary,
      type: 'article',
    },
  };
}

export default async function EventPage({ params }: { params: { id: string } }) {
  const event = await fetchEvent(params.id);
  if (!event) notFound();
  const related = await fetchRelated(event);
  return <EventDetail event={event} related={related} />;
}
```

- [ ] **Step 5: Verify**

```bash
npm run typecheck && npm run lint
```

Expected: both exit 0.

- [ ] **Step 6: Manual smoke**

```bash
./scripts/reset-db.sh > /dev/null 2>&1
EVENT_ID=$(PATH="/opt/homebrew/opt/libpq/bin:$PATH" psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -t -c "SELECT id FROM events WHERE title LIKE '%MV Hondius%' LIMIT 1" | xargs)
echo "Event id: $EVENT_ID"
(npm run dev > /tmp/next-dev.log 2>&1 &) && sleep 10
curl -s "http://localhost:3000/event/$EVENT_ID" | grep -oE 'MV Hondius|Back to dashboard|Related events' | sort -u
pkill -f "next dev" 2>/dev/null; sleep 1; true
```

Expected: prints `Back to dashboard`, `MV Hondius`, and `Related events`.

- [ ] **Step 7: Commit**

```bash
git add app/event components/event/
git commit -m "$(cat <<'EOF'
Add /event/[id] detail page

Server Component fetches event by id (notFound on miss) plus up to
5 related events sharing country_code or category. EventDetail
renders title/summary/metadata grid/tags/raw_content (in collapsible
details). RelatedEvents sidebar lists 5 cards. generateMetadata
provides per-event title/description/openGraph for the detail page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Root OG image + layout metadata

**Files:**
- Create: `app/opengraph-image.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Write `app/opengraph-image.tsx`**

Create `/Users/claude/Projects/project_contagion/app/opengraph-image.tsx`:
```tsx
import { ImageResponse } from 'next/og';
import { createServerClient } from '@/lib/supabase-server';

export const alt = 'Pathwatch — Real-Time Disease Outbreak Tracker';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const supabase = createServerClient();
  const { data: snap } = await supabase
    .from('snapshots')
    .select('total_cases, total_deaths, countries_affected, risk_level')
    .eq('disease', 'hantavirus')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const cases = snap?.total_cases ?? '—';
  const deaths = snap?.total_deaths ?? '—';
  const countries = snap?.countries_affected ?? '—';
  const risk = (snap?.risk_level ?? 'unknown').toUpperCase();
  const riskColor =
    snap?.risk_level === 'critical' ? '#FF3B3B'
    : snap?.risk_level === 'high' ? '#FF6B35'
    : snap?.risk_level === 'moderate' ? '#FFB800'
    : snap?.risk_level === 'low' ? '#4ADE80'
    : '#8888A0';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '64px',
          background: '#0A0A0F',
          color: '#E8E8ED',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: '#4ADE80' }} />
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em' }}>Pathwatch</div>
        </div>

        <div style={{ marginTop: 48, fontSize: 28, color: '#8888A0' }}>
          Real-Time Disease Outbreak Tracker
        </div>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            gap: 48,
            alignItems: 'flex-end',
          }}
        >
          <Stat label="CASES" value={String(cases)} />
          <Stat label="DEATHS" value={String(deaths)} />
          <Stat label="COUNTRIES" value={String(countries)} />
          <div
            style={{
              marginLeft: 'auto',
              padding: '12px 20px',
              borderRadius: 10,
              border: `2px solid ${riskColor}`,
              color: riskColor,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            RISK: {risk}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 16, color: '#8888A0', letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.04em' }}>
        {value}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `app/layout.tsx`** to set base openGraph metadata

Replace the contents of `/Users/claude/Projects/project_contagion/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
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
      <body className="flex min-h-screen flex-col bg-bg font-sans text-text antialiased">
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
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
(npm run dev > /tmp/next-dev.log 2>&1 &) && sleep 10
curl -s -o /tmp/og.png -w "status=%{http_code} type=%{content_type} bytes=%{size_download}\n" \
  "http://localhost:3000/opengraph-image"
pkill -f "next dev" 2>/dev/null; sleep 1; true
```

Expected: `status=200 type=image/png bytes=<some non-zero number>`.

- [ ] **Step 5: Commit**

```bash
git add app/opengraph-image.tsx app/layout.tsx
git commit -m "$(cat <<'EOF'
Add root OG image and openGraph metadata

app/opengraph-image.tsx renders 1200x630 PNG via next/og's
ImageResponse, fetching the latest snapshot for live numbers
and risk badge. layout.tsx declares baseline openGraph and
twitter metadata; Next 14 auto-discovers the opengraph-image.tsx
file and wires the og:image meta tag.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Per-event OG image

**Files:**
- Create: `app/event/[id]/opengraph-image.tsx`

- [ ] **Step 1: Write the per-event OG**

Create `/Users/claude/Projects/project_contagion/app/event/[id]/opengraph-image.tsx`:
```tsx
import { ImageResponse } from 'next/og';
import { createServerClient } from '@/lib/supabase-server';
import { countryFlag } from '@/lib/format';

export const alt = 'Pathwatch event';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SIG_COLOR: Record<number, string> = {
  1: '#6B7280',
  2: '#4ADE80',
  3: '#FFB800',
  4: '#FF6B35',
  5: '#FF3B3B',
};

const SIG_LABEL: Record<number, string> = {
  1: 'ROUTINE',
  2: 'LOW',
  3: 'NOTABLE',
  4: 'HIGH',
  5: 'CRITICAL',
};

export default async function Image({ params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: event } = await supabase
    .from('events')
    .select('title, source_type, country_code, location_name, significance')
    .eq('id', params.id)
    .maybeSingle();

  const title = event?.title ?? 'Event';
  const source = (event?.source_type ?? '').toUpperCase().replace('_', ' ');
  const flag = countryFlag(event?.country_code ?? null);
  const location = event?.location_name ?? event?.country_code ?? '';
  const sig = (event?.significance as 1 | 2 | 3 | 4 | 5 | undefined) ?? 1;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '64px',
          background: '#0A0A0F',
          color: '#E8E8ED',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: '#4ADE80' }} />
          <div style={{ fontSize: 28, fontWeight: 700 }}>Pathwatch</div>
          <div style={{ marginLeft: 'auto', fontSize: 18, color: '#8888A0' }}>{source}</div>
        </div>

        <div
          style={{
            marginTop: 48,
            fontSize: 56,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 24,
          }}
        >
          {flag && <div style={{ fontSize: 56 }}>{flag}</div>}
          {location && (
            <div style={{ fontSize: 28, color: '#8888A0' }}>{location}</div>
          )}
          <div
            style={{
              marginLeft: 'auto',
              padding: '12px 20px',
              borderRadius: 10,
              border: `2px solid ${SIG_COLOR[sig]}`,
              color: SIG_COLOR[sig],
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '0.08em',
            }}
          >
            {SIG_LABEL[sig]}
          </div>
        </div>
      </div>
    ),
    { ...size },
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
git add app/event/[id]/opengraph-image.tsx
git commit -m "$(cat <<'EOF'
Add per-event OG image

Renders 1200x630 with title (line-clamped to 4), source label,
country flag + location, and significance badge color-coded to
match the dashboard's palette.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Mobile polish — responsive map height

**Files:**
- Modify: `components/map/MapPanel.tsx`

- [ ] **Step 1: Replace the map's container height**

Open `/Users/claude/Projects/project_contagion/components/map/MapPanel.tsx`. Change the final return block's inner `<div>` className:

Before:
```tsx
<div ref={containerRef} className="h-[280px] w-full" />
```

After:
```tsx
<div ref={containerRef} className="h-[220px] w-full sm:h-[280px]" />
```

- [ ] **Step 2: Verify**

```bash
npm run typecheck && npm run lint
```

Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/map/MapPanel.tsx
git commit -m "$(cat <<'EOF'
Mobile polish: shrink map to 220px below sm breakpoint

Map dominates narrow screens at 280px. Drop to 220px below the
Tailwind sm breakpoint so the surrounding panels (trend, source
activity, country breakdown) stay above the fold on phones.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Add Playwright specs for event detail and OG

**Files:**
- Modify: `tests/dashboard.spec.ts`

- [ ] **Step 1: Append two new tests**

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
  await expect(page.locator('.maplibregl-ctrl-attrib')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('source-activity-chart')).toBeVisible();
  await expect(page.getByText(/Need at least 2 snapshots/i)).toBeVisible();
});

test('event detail page renders', async ({ page }) => {
  await page.goto('/');
  await page.getByText(/MV Hondius/i).first().click();
  await expect(page).toHaveURL(/\/event\/[0-9a-f-]+/);
  await expect(page.getByRole('heading', { level: 1, name: /MV Hondius/i })).toBeVisible();
  await expect(page.getByText(/Back to dashboard/i).first()).toBeVisible();
});

test('OG image generates', async ({ request }) => {
  const res = await request.get('/opengraph-image');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/png');
});
```

- [ ] **Step 2: Run the smoke**

```bash
npm run test:smoke 2>&1 | tail -10
```

Expected: `4 passed (Xs)`.

- [ ] **Step 3: Commit**

```bash
git add tests/dashboard.spec.ts
git commit -m "$(cat <<'EOF'
Extend smoke for event detail navigation and OG image

Two new specs: clicking a feed event navigates to /event/<id>
and renders the heading + back link; /opengraph-image returns
200 with image/png content-type.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Deploy prep files (`vercel.json`, `.env.production.example`, README)

**Files:**
- Create: `vercel.json`
- Create: `.env.production.example`
- Modify: `README.md`

- [ ] **Step 1: Write `vercel.json`**

Create `/Users/claude/Projects/project_contagion/vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs"
}
```

- [ ] **Step 2: Write `.env.production.example`**

Create `/Users/claude/Projects/project_contagion/.env.production.example`:
```
# Set these in Vercel project settings (not committed). Production-only scope.
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...or_legacy_anon_jwt
```

- [ ] **Step 3: Append "Production deploy" section to `README.md`**

Open `/Users/claude/Projects/project_contagion/README.md`. Append at the end:

```markdown

## Production deploy

Deploy is GitHub-driven: push to `main` triggers a Vercel build. One-time setup:

1. **Provision a Supabase project.** Sign in at supabase.com, "New project". Note the project ref (the part before `.supabase.co`), the API URL, and the publishable (anon) key from the API settings page.

2. **Apply the migration to the prod project.** From this repo:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

3. **Optionally seed prod.** Open the prod project's Studio (Supabase web UI) → SQL editor → paste `supabase/seed.sql` → run. Skip if you want production to start empty (the data pipeline in sub-project 3 will fill it).

4. **Authenticate `gh` and `vercel` locally** (one-time):
   ```bash
   gh auth login -h github.com -w
   vercel login
   ```

5. **Create the GitHub repo and push:**
   ```bash
   gh repo create pathwatch --public --source=. --push
   ```

6. **Link this directory to a Vercel project:**
   ```bash
   vercel link
   ```
   Accept the defaults (link to current directory, framework: Next.js detected).

7. **Set env vars in the Vercel project.** Either via CLI or the project's Settings → Environment Variables UI. Production-only scope:
   - `NEXT_PUBLIC_SUPABASE_URL` — value from step 1
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — value from step 1

8. **Trigger the first production deploy:**
   ```bash
   vercel --prod
   ```

After this, every push to `main` auto-deploys. Branch pushes get preview deployments.
```

- [ ] **Step 4: Verify**

```bash
npm run typecheck && npm run lint
```

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add vercel.json .env.production.example README.md
git commit -m "$(cat <<'EOF'
Add deploy config + Production deploy README section

vercel.json hints framework: nextjs. .env.production.example
documents the prod env-var schema. README walks through one-time
setup: provision Supabase, apply migration, gh/vercel auth, push,
link, set env vars, first vercel --prod.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Provision Supabase production project + apply migration

**Files:** none (external setup)

This task is **mostly user actions**. Pause and ask the user to perform each web step; you (the agent) run the CLI commands.

- [ ] **Step 1: USER ACTION — provision Supabase prod**

Ask the user:

> "Open https://supabase.com/dashboard, sign in, create a new project (any region close to your users; free tier is fine). When it's ready, paste the project ref (the part before `.supabase.co`) here. Also note the publishable (anon) key from the project's API settings."

Wait for the user to paste the project ref and key.

- [ ] **Step 2: Link the local CLI to the remote project**

Once the user provides `<PROJECT_REF>`:

```bash
supabase link --project-ref <PROJECT_REF>
```

Expected: prompts for the database password (the user sets this when creating the project; if they didn't note it, they can reset it in the Supabase project's database settings). Returns "Linked to project".

- [ ] **Step 3: Apply the migration**

```bash
supabase db push
```

Expected: applies `supabase/migrations/20260507000000_initial_schema.sql` to the remote project. Prints "Finished supabase db push."

- [ ] **Step 4: USER ACTION — seed prod (optional)**

Ask the user:

> "Want to seed the prod project with the MV Hondius outbreak data so the dashboard isn't empty on first load? If yes, open the prod project's SQL editor in Supabase Studio, paste the contents of `supabase/seed.sql`, and run it. Type 'yes-seeded' when done, or 'skip' to leave prod empty."

Wait for the user's response.

- [ ] **Step 5: No commit needed**

This task changes no local files; nothing to commit.

---

### Task 9: Push to GitHub

**Files:** none

- [ ] **Step 1: USER ACTION — authenticate `gh` if not already**

Ask the user (if `gh auth status` reports no valid auth):

> "Run `gh auth login -h github.com -w` in your terminal (use the `! ` prefix to run it in this session). It opens a browser to authorize."

Wait for the user to confirm.

- [ ] **Step 2: Verify auth**

```bash
gh auth status 2>&1 | head -5
```

Expected: `Logged in to github.com account <username>`. If not, return to Step 1.

- [ ] **Step 3: Create the repo and push**

```bash
gh repo create pathwatch --public --source=. --push
```

Expected: creates `https://github.com/<username>/pathwatch`, sets it as `origin`, pushes `main`. Prints the repo URL.

- [ ] **Step 4: Verify the remote**

```bash
git remote -v && git log origin/main --oneline | head -3
```

Expected: `origin` points at `https://github.com/<username>/pathwatch.git`. Commits are visible on `origin/main`.

- [ ] **Step 5: No commit needed**

The push itself is the deliverable; no local file changes.

---

### Task 10: Link Vercel + first production deploy

**Files:** none

- [ ] **Step 1: USER ACTION — authenticate `vercel` if not already**

Ask the user:

> "Run `vercel login` in your terminal (use `!` prefix). Choose 'Continue with GitHub' for the smoothest flow."

Wait for the user to confirm.

- [ ] **Step 2: Verify auth**

```bash
vercel whoami 2>&1
```

Expected: prints the user's Vercel username/email.

- [ ] **Step 3: Link the project**

```bash
vercel link --yes
```

Expected: scans the directory, detects Next.js, creates a Vercel project (defaults to repo name `pathwatch`), writes `.vercel/` linking metadata. The `.vercel/` dir is gitignored by default.

- [ ] **Step 4: Add `.vercel/` to gitignore if not already present**

```bash
grep -q "^\.vercel" .gitignore || echo ".vercel" >> .gitignore
git add .gitignore && git commit -m "Add .vercel to gitignore" 2>&1 | tail -2 || echo "no change"
```

- [ ] **Step 5: Set production env vars**

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# When prompted, paste the Supabase project URL from Task 8 step 1
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# When prompted, paste the Supabase publishable (anon) key from Task 8 step 1
```

Expected: both commands prompt once for the value and confirm "Added".

- [ ] **Step 6: Deploy to production**

```bash
vercel --prod
```

Expected: streams build logs, then prints `Production: https://pathwatch-<hash>.vercel.app` (or similar). Open the URL — the dashboard should render with whatever you seeded in Task 8.

- [ ] **Step 7: Smoke the production URL**

```bash
PROD_URL=$(vercel inspect 2>&1 | grep -E 'https://.*\.vercel\.app' | head -1 | awk '{print $1}')
echo "Production URL: $PROD_URL"
curl -s "$PROD_URL" | grep -oE 'Pathwatch|MV Hondius' | sort -u
```

Expected: prints `Pathwatch` (always) and `MV Hondius` (if you seeded prod in Task 8).

- [ ] **Step 8: No commit needed**

Production is live; no local file changes.

---

### Task 11: Final verification

**Files:** none

- [ ] **Step 1: Local end-to-end check**

```bash
npm run lint && npm run typecheck && npm run build && npm run test:smoke
```

Expected: all four exit 0. Build output should now include `/event/[id]` as a dynamic route.

- [ ] **Step 2: Confirm git log**

```bash
git log --oneline | head -16
```

Expected: 7 implementation commits + the spec/plan commits + 2b merge as the start.

- [ ] **Step 3: Hand off**

Plan is complete. Use `superpowers:finishing-a-development-branch` to merge `feat/frontend-2c` to main. After merge, the next push to `main` triggers another production deploy via Vercel's git integration.

---

## Verification (full plan complete)

After Task 11:
- Locally: `npm run dev` and click any event card — opens `/event/<id>` with full content + related events.
- `/opengraph-image` returns a 1200x630 PNG.
- `/event/<id>/opengraph-image` returns a 1200x630 PNG with the event's title.
- GitHub repo `pathwatch` exists with the full history.
- Vercel project `pathwatch` is linked and has had at least one successful production deploy.
- Visiting the Vercel production URL shows the live dashboard.
- Future `git push origin main` automatically triggers a new production deploy.

## Out of scope (future work)

- Sub-project 3: data pipeline (Cowork-session scrapers writing to prod Supabase)
- Sub-project 4: snapshot/analysis cadence
- Custom domain (`pathwatch.com` or similar)
- Bottom-sheet popup drawer for narrow screens
- 3D globe view
- Multi-disease support
