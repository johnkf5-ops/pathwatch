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
