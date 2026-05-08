# Pathwatch Frontend 2c — Event Detail + OG + Deploy

**Date:** 2026-05-07
**Sub-project:** 2c of 4 (final frontend cycle)
**Status:** Draft, awaiting user review
**Depends on:** sub-projects 2a + 2b, both merged to main

## Context

The dashboard is feature-complete on `main` with stats, feed, map, charts, and country breakdown. This cycle ships the last three pieces:

1. **`/event/[id]` detail page** — clicking an event card in the feed lands on a full view with related events.
2. **Dynamic OG images** — social-share cards generated at request time via Next 14's `next/og` for the dashboard root and per-event pages.
3. **GitHub + Vercel auto-deploy** — push to GitHub, Vercel auto-deploys on every push to `main`. No CI yaml, no manual deploy commands after the initial setup.

## Goals

1. EventCard becomes a link; clicking the title or anywhere on the card navigates to `/event/<id>`.
2. The detail page renders the full event with related-event suggestions; missing IDs return a real 404.
3. OG images for `/` and `/event/[id]` produce 1200×630 PNGs reflecting current data.
4. After one-time `gh` + `vercel` auth, deployment is `git push` and watch.
5. Production Supabase is provisioned and seeded with the same schema and (optionally) seed data as local.

## Non-goals

- Mobile bottom-sheet drawer (YAGNI for v1).
- Multi-disease selector (v2).
- 3D globe (v2).
- CI/CD via GitHub Actions (Vercel's git integration replaces this for v1).
- Custom domain configuration (use Vercel's default `*.vercel.app` URL initially).

## Architecture

### `/event/[id]` page

Server Component. Fetches one event by id from Supabase using the existing `createServerClient`. Calls `notFound()` if missing → triggers `app/event/[id]/not-found.tsx`. Renders:

- Header: `← Back to dashboard` link
- Significance dot + source icon + relative time
- Full title
- Summary paragraph
- Raw source content (in a styled `<pre>` block) if `raw_content` is non-null
- Metadata grid: country/region/location, lat/lng, case/death counts, verified status, tags
- "Source ↗" link to `source_url`
- Related events sidebar (5 items): events sharing `country_code` OR `category`, excluding self, ordered by `created_at DESC`. Empty-state copy if none.

### OG images

Two routes via `next/og`'s `ImageResponse`:

- `app/opengraph-image.tsx` — root OG. Fetches latest snapshot. Renders dark background, "Pathwatch" wordmark in JetBrains Mono, big numbers (cases / deaths / countries) and risk badge, subline "Real-Time Disease Outbreak Tracker". Edge runtime.
- `app/event/[id]/opengraph-image.tsx` — per-event OG. Fetches event by id. Renders title (truncated to 2 lines), source label, country flag + name, significance label/color block.

Both files export a default async function returning `ImageResponse(...)`. Next 14's metadata system auto-discovers them — no extra config.

### EventCard becomes a link

Wrap the EventCard's body in `<Link href={`/event/${event.id}`}>` so the entire card is clickable except the existing "Source ↗" link, which keeps `target="_blank"` and stops propagation. Adds a `hover:bg-surface-hover` cursor affordance.

### GitHub + Vercel deployment

```
[ developer ] -- git push --> [ GitHub: main branch ]
                                     │
                                     │ Vercel GitHub App
                                     ▼
                              [ Vercel build ] -- env vars from Vercel project --> [ Production ]
```

Setup steps (one-time, user actions and commands documented in README):

1. **Provision Supabase prod project** — `supabase.com` web UI, free tier. Note the project ref + URL + anon (publishable) key.
2. **Apply migration to prod** — locally: `supabase link --project-ref <ref>` then `supabase db push`.
3. **Seed prod (optional)** — paste `supabase/seed.sql` into Supabase Studio's SQL editor for the prod project. Skip if going live without seed.
4. **Auth GH and Vercel locally** — `gh auth login -h github.com -w` and `vercel login`. Both interactive, both one-time.
5. **Create GH repo + push** — `gh repo create pathwatch --public --source=. --push`.
6. **Link Vercel project to repo** — `vercel link` (auto-detects git remote). Optionally `vercel --prod` for first deploy; subsequent pushes auto-deploy.
7. **Set Vercel env vars** — in the Vercel project's settings UI: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for production. Mark as production-only.

### Files added or modified

```
app/
├── event/[id]/
│   ├── page.tsx                  NEW: RSC fetch + render EventDetail + RelatedEvents
│   ├── not-found.tsx             NEW: 404 page
│   └── opengraph-image.tsx       NEW: per-event OG
├── opengraph-image.tsx           NEW: root OG
└── layout.tsx                    MODIFY: + openGraph + twitter metadata

components/event/
├── EventDetail.tsx               NEW: full event view
└── RelatedEvents.tsx             NEW: sidebar list

components/feed/
└── EventCard.tsx                 MODIFY: wrap card body in Link

tests/
└── dashboard.spec.ts             MODIFY: + 2 specs (event detail nav, OG image)

vercel.json                       NEW: minimal framework hint
.env.production.example           NEW: prod env-var schema
README.md                         MODIFY: + Production deploy section
```

## Data flow contracts

### `/event/[id]/page.tsx`

```ts
import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';

export default async function EventPage({ params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: event } = await supabase.from('events').select('*').eq('id', params.id).maybeSingle();
  if (!event) notFound();
  const { data: related } = await supabase
    .from('events').select('*')
    .or(`country_code.eq.${event.country_code},category.eq.${event.category}`)
    .neq('id', event.id).is('duplicate_of', null)
    .order('created_at', { ascending: false }).limit(5);
  return <EventDetail event={event} related={related ?? []} />;
}
```

(Note: only build the `country_code` clause if non-null — handled in implementation.)

### OG image routes

```ts
// app/opengraph-image.tsx
import { ImageResponse } from 'next/og';
import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'edge'; // when on Vercel; falls back to nodejs locally
export const alt = 'Pathwatch — Real-Time Disease Outbreak Tracker';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const supabase = createServerClient();
  const { data: snap } = await supabase
    .from('snapshots').select('*').eq('disease', 'hantavirus')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return new ImageResponse(/* JSX with snap data */, { ...size });
}
```

`alt`, `size`, `contentType` are statics Next reads to wire metadata. `runtime = 'edge'` is preferred but `next/og` works in node-runtime too — we'll use the default and let Vercel optimize.

## Loading / empty / error states

| Surface | Loading | Empty | Error |
|---|---|---|---|
| `/event/[id]` | RSC blocks (no skeleton) | `notFound()` triggers `not-found.tsx` ("Event not found, back to dashboard") | route error.tsx already exists |
| Related events | n/a | "No related events yet" copy | swallowed (returns empty list) |
| Root OG | brief 200ms | uses `—` placeholders if snapshot absent | Next surfaces a built-in OG fallback |
| Event OG | brief 200ms | shouldn't happen (page would 404 first) | same |

## Mobile polish (light)

Spec section 2c calls for "make mobile good, not just it works." Concretely:

- Map height clamp at `< sm`: `h-[220px]` instead of `h-[280px]`. Single class swap.
- Country breakdown table already responsive via `overflow-x-auto`.
- EventCard tap targets: ensure entire card body is the link (covered by EventCard modification).
- No bottom-sheet drawer for popups — out of scope.

## Testing

Add two specs to `tests/dashboard.spec.ts`:

```ts
test('event detail page renders', async ({ page }) => {
  await page.goto('/');
  await page.getByText(/MV Hondius/i).first().click();
  await expect(page).toHaveURL(/\/event\/[0-9a-f-]+/);
  await expect(page.getByRole('heading', { name: /MV Hondius/i })).toBeVisible();
  await expect(page.getByText(/Back to dashboard/i)).toBeVisible();
});

test('OG image generates', async ({ request }) => {
  const res = await request.get('/opengraph-image');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/png');
});
```

The first spec depends on EventCard's link wrapping. The OG spec exercises the route without inspecting pixels (visual snapshot tests are out of scope).

## Build / bundle impact

- `next/og` adds ~0 KB to the route bundles — it's a separate runtime endpoint.
- `/event/[id]` route is dynamic (RSC with DB fetch) — uses the same `force-dynamic` pattern as `/`.
- `not-found.tsx` is statically rendered.

## Risks and open questions

- **Vercel-Edge Supabase fetch:** the anon key works fine from Edge runtime. URL must be HTTPS (production). For OG locally we run on Node.
- **`maybeSingle()` returning null silently** if multiple rows match: events are unique by id (PK), so single match guaranteed.
- **`.or()` syntax in Supabase JS** requires comma-separated filters in `column.op.value` form. Implementation handles the case where `country_code` is null on the source event (skip that filter).
- **Vercel free-tier limits:** 100 GB-hours of edge function execution per month. Way under for a hobby dashboard.
- **Auto-deploy on `main` only:** Vercel default. Branches get preview deployments, which is fine — actually a feature.

## Out of scope

- 3D globe (v2)
- Multi-disease selector (v2)
- Bottom-sheet popup drawer for mobile
- Custom domain configuration — keep `*.vercel.app` for v1
- GitHub Actions CI (Vercel's integration covers builds)
- Service-role pipeline writing to prod (sub-project 3)
