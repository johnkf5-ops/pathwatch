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

// Title-content filter. Google News broad queries (e.g. `"Andes virus"`,
// `hantavirus 2026`) silently pad the RSS with trending unrelated stories
// from trusted domains — Beatles articles from AP, NBA news from Reuters,
// etc. Domain allowlist alone caught the source; this regex catches the
// topic. Conservative substring match on the 4 canonical names; anything
// outside these is dropped.
export const TOPIC_PATTERN = /(hantavirus|andes\s+virus|mv\s+hondius|\bandv\b)/i;

export function filterItems(
  items: RawNewsItem[],
  opts: { allowedDomains: ReadonlySet<string>; maxAgeHours: number; now?: Date },
): RawNewsItem[] {
  const now = (opts.now ?? new Date()).getTime();
  const maxAgeMs = opts.maxAgeHours * 60 * 60 * 1000;
  return items.filter((it) => {
    if (!opts.allowedDomains.has(it.source_domain)) return false;
    if (it.published_at == null) return false;
    if (!TOPIC_PATTERN.test(it.title)) return false;
    const age = now - new Date(it.published_at).getTime();
    return age >= 0 && age <= maxAgeMs;
  });
}
