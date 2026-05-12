# Source denylist

Domains that **must never** be cited in `cases.dossier`, `facts.sources`, `events.source_url`, or any other public-facing record. The existing credibility-tier system (`docs/runbooks/pipeline.md` §3.5) ranks acceptable sources; this file enumerates the explicit "no" list and the reasoning.

The denylist exists because credibility-tier rules alone don't catch:
- **Competitor trackers** (other outbreak-dashboard sites). Citing them is free advertising for a peer product and creates a circular-reference loop where their site and ours co-amplify unverified claims.
- **Personal blogs / Substack newsletters / Medium posts.** Even when written by domain experts, the editorial review is one person. They're typically summarizing primary sources we should be citing directly.
- **Aggregators that republish wires without original reporting** (e.g. medicalxpress, news.google.com article URLs). The wire (Reuters / AP / etc.) is the credible source; the aggregator is noise.

## Hard denylist

Never cite. If a claim is supported *only* by one of these, drop the claim or find a real source.

| Domain pattern | Type | Why |
|---|---|---|
| `hantavirusmap.com` | competitor tracker | Peer product. Circular reference. |
| `*.substack.com` | newsletter | Single-author editorial; cite their primary sources instead. |
| `*.wordpress.com` | personal blog | Not a publication. |
| `*.medium.com` | personal blog | Not a publication. |
| `*.blogspot.com` | personal blog | Not a publication. |
| `medicalxpress.com` | press-release aggregator | Republishes without original reporting. |
| `news.google.com` (article URLs, not the RSS endpoint) | aggregator redirect | Always trace to the publisher domain instead. |

## Soft denylist (avoid unless corroborated by tier 1-2)

Real outlets, but low-credibility or single-issue. Acceptable only when corroborating a claim that has a tier-1-2 source as the primary.

| Domain pattern | Notes |
|---|---|
| `gbnews.com` | Partisan UK channel. |
| `nomadlawyer.org`, `rustourismnews.com`, `sortiraparis.com` | Travel/lifestyle blogs. |
| `newsworm.de`, `njtoday.news`, `thespanisheye.com`, `moncloa.com` | Small aggregators / regional outlets with unclear editorial standards. |

## Add a domain to the denylist

If a cycle surfaces a new tracker / blog / questionable aggregator, append it to the table above with a one-line rationale, then run the audit query below to find and clean any existing citations.

## Audit query

Run after every cycle to catch denylisted domains in dossiers:

```sql
WITH urls AS (
  SELECT case_code, regexp_matches(dossier, 'https?://[^ )\]\"\n]+', 'g') AS url
  FROM cases WHERE dossier IS NOT NULL
)
SELECT
  regexp_replace(url[1], '^https?://(www\.)?([^/]+)/.*$', '\2') AS domain,
  count(*) AS cite_count,
  string_agg(DISTINCT case_code, ', ') AS cases
FROM urls
WHERE url[1] ~* '(hantavirusmap\.com|\.substack\.com|\.wordpress\.com|\.medium\.com|\.blogspot\.com|medicalxpress\.com|news\.google\.com)'
GROUP BY 1
ORDER BY cite_count DESC;
```

If this returns any rows, the pipeline ran without honoring the denylist — clean before the next cycle.
