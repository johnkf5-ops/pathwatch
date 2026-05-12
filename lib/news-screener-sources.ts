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
