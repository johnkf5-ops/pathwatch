# Pathwatch Pipeline Runbook

**Audience:** Future Claude instance (or human operator) driving the Claude session that scrapes, fact-checks, and writes data into the Pathwatch Supabase database.

**Read this at session start before doing any pipeline work.**

## What you are

You ARE the pipeline. There is no scheduled cron, no headless agent — you operate it from a Claude session (Claude Code, Cowork, or any other Claude client with the Supabase CLI available). Each "cycle" you run = one full scrape → dedupe → process → fact-check → write loop. The dashboard at https://pathwatch-phi.vercel.app reads what you write.

## Connection

| | |
|---|---|
| Supabase URL | `https://wtatysorlkcteleqjzkm.supabase.co` |
| Schema | events, snapshots, country_stats, scrape_log, cases, case_locations, facts, threat_assessments, visitor_log |
| Access pattern (preferred) | `supabase db query --linked` for all reads and writes. The Supabase CLI is already authenticated via `vercel link` / `supabase link`. No service-role key needed in session env. |
| Service role key (fallback) | Available in Supabase dashboard → Settings → API Keys → "Secret key" if a session must use REST API for some reason. **Never commit this.** |
| Realtime | Enabled on events, snapshots, country_stats, cases, case_locations, facts, threat_assessments, visitor_log |

See `docs/runbooks/pipeline-operator.md` for operator-facing setup details.

## Cycle cadence

| Mode | Frequency | When |
|---|---|---|
| Active | every 15–30 min | normal monitoring |
| Off-hours | every 60 min | midnight–6 AM local |
| Surge | every 5–10 min | new country reports a case, WHO press conference, DON update, or fatality count change |

A "cycle" = the 5 steps below. Aim for ~10–15 min wall-clock per cycle.

## Per-cycle ops

### 1. Scrape

The agent picks 2-3 outlets per fired group per cycle. Cadence (which groups fire each cycle) is documented in §1 cadence below; rotation mechanism in §1 rotation.

#### Source denylist — never cite these

Before the source groups, the hard rule: never cite competitor outbreak trackers, personal blogs, Substack newsletters, Medium posts, Blogspot, or press-release aggregators (medicalxpress, news.google.com article URLs). Full list with rationale and the post-cycle audit query: `docs/runbooks/source-denylist.md`. If a claim is supported only by a denylisted domain, find a primary source or drop the claim.

#### Source groups (illustrative — agent picks 2-3 per group per cycle)

1. **Primary outbreak surveillance (Credibility Tier 1):** WHO DON + WHO daily press briefings + WHO YouTube/X feeds, CDC (HAN + RSS https://tools.cdc.gov/api/v2/resources/media/rss + media releases + press briefings + press conferences), ECDC, Africa CDC, plus national health authorities — UKHSA, RIVM, RKI (incl. Kontaktpersonen guidance pages), Swiss FOPH, Spanish Sanidad / Moncloa press-conference page, Singapore CDA, PHAC, Sante Publique France
2. **Wire services (Cred Tier 1-2):** AP News, AFP, UPI, DPA, EFE, Kyodo, Reuters
3. **US national news (Cred Tier 2-3):** WaPo, NYT, NBC, ABC, CBS, CNN, NPR, USA Today
4. **US federal-policy specialists (Cred Tier 2):** Politico, Axios, The Hill *(every-cycle priority — surface where federal-agency verbal clarifications surface first)*
5. **UK national (Cred Tier 2-3):** BBC, Guardian, Sky News, ITV, Telegraph, Independent
6. **EU regional (Cred Tier 2-3):** El País, El Mundo, NL Times, DutchNews, RTÉ, Irish Times, ANSA, Le Monde, France24, Euronews, Der Spiegel
7. **Latin America (Cred Tier 2-3, critical for outbreak-source tracing):** Clarín, La Nación, Mercurio, Folha de São Paulo, Infobae
8. **Asia / Oceania / Africa (Cred Tier 2-3):** SCMP, Mothership, Straits Times, RNZ, 1News, News24, IOL, Türkiye Today
9. **Scientific / public health (Cred Tier 1-2):** virological.org, CIDRAP, STAT News, ProMED, Nature News, Science Magazine, The Lancet, NEJM, JAMA, medRxiv, bioRxiv
10. **Tabloid / popular press (Cred Tier 3-4, requires corroboration search):** NY Post, Daily Mail, The Sun, Mirror, Daily Beast
11. **Aggregators / firehose:** Google News (`"hantavirus 2026"` + `"MV Hondius"`), Bing News
12. **Social media (Cred Tier 4, signal-only — never sole source for sig-3+):** X/Twitter (Chrome MCP, top 20-30 results since last scrape, 2-5 sec random delays), Reddit (https://www.reddit.com/r/{worldnews,medicine,epidemiology,health}/search.json?q=hantavirus&sort=new&t=day), BlueSky search API
13. **Reference (Cred Tier 4, early-signal only — never confirmation):** Wikipedia https://en.wikipedia.org/wiki/MV_Hondius_hantavirus_outbreak — check for substantive edits
14. **Prediction markets (context layer):** Polymarket gamma-api, Kalshi (covered by the threat-assessment cycle, not the scrape cycle)

Named outlets within a group are illustrative — the agent picks 2-3 per fired group per cycle. The goal is breadth-over-time, not exhaustive depth-per-cycle.

Capture for every event: URL, full text, author/handle, timestamp, engagement counts. Persist raw text in `events.raw_content`.

#### Cadence rule (which groups fire each cycle)

- **Every cycle:** groups 1-2 (primary surveillance + wires), **plus group 4 (US federal-policy specialists)**.
- **At least once per 4 cycles:** groups 3, 5-9 (US national + UK + EU + LatAm + Asia/Oceania/Africa + scientific). Pool covered by rotation, not exhaustive per-cycle sweep.
- **On surge or when story-type makes it relevant:** groups 10-11 (tabloid + aggregators).
- **Always available:** groups 12-13 (social media + reference) for early signal. Sampled when other groups produce nothing new and weak-signal coverage is wanted.

Group 4 is elevated because federal-policy specialists are the channel where agency verbal clarifications surface before wires pick them up; the CDC quarantine-clarification miss was directly traceable to group 4 not being part of the every-cycle pool.

#### Rotation mechanism (deterministic, session-independent)

The agent queries `scrape_log` at cycle start to determine which groups in the rotation pool have the oldest most-recent entry, and selects those for this cycle. The agent does not maintain rotation state in conversation context or across sessions — `scrape_log` is the source of truth.

Per cycle, the agent writes both per-outlet `scrape_log` rows AND a per-group rollup row. Group rollup rows use `source_type` of the form `'group:<identifier>'`, e.g. `'group:eu-regional'`, `'group:scientific'`, `'group:us-national'`, `'group:federal-policy-specialists'`, `'group:uk-national'`, `'group:lat-am'`, `'group:asia-oceania-africa'`. (`scrape_log.source_type` is plain TEXT with no CHECK constraint enumerating values; the `group:*` convention is additive.)

Rotation query at cycle start:

```sql
SELECT source_type, MAX(created_at) AS last_seen
FROM scrape_log
WHERE source_type LIKE 'group:%'
  AND source_type IN ('group:us-national', 'group:uk-national',
                      'group:eu-regional', 'group:lat-am',
                      'group:asia-oceania-africa', 'group:scientific')
GROUP BY source_type
ORDER BY last_seen ASC NULLS FIRST
LIMIT 2;
```

The two oldest groups are this cycle's rotation pick. If a group has never been written, it ranks first (NULLS FIRST). After the cycle, the agent inserts a `scrape_log` row with `source_type = 'group:<id>'` for each group it actually hit, alongside per-outlet rows.

#### Corroboration search vs opposing search (distinct mechanisms)

These are different tools with different inputs and different outputs. Both can fire on the same event when applicable.

| | **Corroboration search** | **Opposing search (Rule B)** |
|---|---|---|
| **Trigger** | Unverified claim surfacing only on Cred Tier 3-4 outlet | Binary policy claim, any source tier |
| **Question** | Does any Cred Tier 1-2 source confirm this? | Is the framing contested? |
| **If yes** | Promote significance, update tags, drop `requires-corroboration` | Side-by-side both quotes, tag `policy-ambiguity`, agent doesn't pick a side |
| **If no** | Hold at sig-2 with `requires-corroboration` tag; agent doesn't promote | Single-framing event proceeds normally |

Tabloid (group 10) stories run **corroboration search**, not Rule B. Rule B's opposing search is unchanged — covers binary policy framings regardless of source tier.

### 2. Dedupe

For each scraped item:

1. **URL hash exact match**: the DB has a unique partial index on `events.source_url_hash` — duplicate URLs error on insert. If you hit `23505`, the item is already stored.
2. **Semantic similarity** against events from the last 48h. If it's a new source reporting the same story, INSERT a new event with `duplicate_of` = the original event's id. (Allows corroboration counting later.)
3. **Corroboration trigger**: 3+ independent sources reporting the same claim → run a fact-check pass against the `facts` table.

### 3. Process & score

For each unique item:

- **Classify** category from this list: `case_report | policy | research | travel_advisory | mutation | death | containment | speculation`
- **Extract** numeric values where possible: `case_count`, `death_count`, geographic location (country/region/city), lat/lng
- **Geocode** via known centroids when lat/lng missing
- **Score significance** 1–5:
  - **5 (Critical)**: first case in new country, major policy change, significant death-toll increase, WHO emergency declaration
  - **4 (High)**: official government statement, travel advisory, new research findings
  - **3 (Notable)**: case-count update, expert opinion, containment measure
  - **2 (Low)**: local news coverage, useful social-media discussion
  - **1 (Routine)**: general discussion, speculation, reposts of known info
- **Tag** with strain (`andes-virus`), context (`mv-hondius`), and topic (`transmission`, `cfr`, `human-to-human`, etc.)
- For binary policy claims (mandatory/voluntary, banned/allowed, confirmed/denied, will/may, declared/withdrawn), see `## Write-time rigor for sig-4+ items` §B (opposing-search) and §D (Rule D follow-up agency-channel checks on subsequent cycles).

### 4. Fact-check

For every claim in the new item:

```
Does it match an existing CONFIRMED fact?
├── Yes → score routine (sig 1–2), note corroboration in tags
└── No
    ├── Does it CONTRADICT an existing CONFIRMED fact?
    │   └── Yes → flag, score 3+, tag 'contradicts-known-fact', DO NOT auto-update facts
    └── Is it a NEW factual claim?
        ├── Tier-1 source (WHO/CDC/ECDC/Africa CDC/peer-reviewed)?
        │   → INSERT facts row, status='confirmed', confidence 0.9–1.0
        ├── 2+ independent credible sources?
        │   → INSERT facts row, status='corroborated', confidence 0.7–0.9
        ├── Single credible source?
        │   → INSERT facts row, status='unverified', confidence 0.4–0.7
        └── Single uncredible source (Reddit / random social)?
            → DO NOT create fact yet; only log event with sig 1–2; watch for corroboration
```

Speculation, opinion, analysis → log as event with category `speculation` or `research`. **Never** add to facts.

### 4.5. URL verification (mandatory before any write)

**Every candidate event must have a `source_url` that actually resolves.** Verify via the three-tier mechanism below before INSERT.

#### Tier A — curl (default)

```
curl -s -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" \
  -o /dev/null -w "%{http_code}\n" <url>
```

Then a content sniff:

```
curl -s -L -A "<same UA>" <url> | head -c 8000
```

**Success:** HTTP 200 + body contains expected article markers (title, byline, body text). Set `is_verified = true`.

**Escalate to Tier B (failure signatures):**
- HTTP 401 or 403 with body length > 0
- HTTP 200 with body containing any of:
  - `Please enable JavaScript`
  - `<title>Just a moment...</title>`
  - `data-cf-beacon`
  - `_Incapsula_Resource`
  - `dd_async_token`
  - `Access denied — DataDome`
- HTTP 200 with body length < 5 KB (likely challenge page, not article — real challenge pages are typically 1-3 KB and would slip past a 500-byte filter)

#### Tier B — Playwright MCP (escalation)

When Tier A signatures match a bot-protection failure, call Playwright MCP server tools (`mcp__plugin_playwright_playwright__browser_navigate`, then `mcp__plugin_playwright_playwright__browser_snapshot` or `mcp__plugin_playwright_playwright__browser_evaluate` for body text extraction). Playwright runs a real browser and passes the bot challenge.

Outlets typically requiring Tier B: Reuters, Bloomberg, WaPo, FT, Telegraph, some EU regional outlets (Le Monde, Der Spiegel articles behind dynamic loaders).

**Success:** rendered article content matches expected markers. Set `is_verified = true`.

**Escalate to Tier C (failure signatures):**
- Rendered body does not contain any keyword from the search snippet
- Body contains paywall markers:
  - `Subscribe to read`
  - `Sign in to continue`
  - `This article is for subscribers`
- Playwright returns timeout or error

**If Playwright MCP server is unavailable** (operator missed the precondition — see `pipeline-operator.md` Prerequisites): record `is_verified = false` with tag `tier-b-unavailable`. **Do not silently fall through to Tier C** — the failure is operator-fixable and the tag flags it for rerun.

#### Tier C — snippet-only (final fallback)

True paywalls where Tier B's rendered content is gated. Use the search-result snippet text only, quote verbatim into `events.summary`, set `is_verified = false`, tag `paywalled-source`, and proceed.

Outlets typically requiring Tier C: FT, WSJ behind hard paywall, Bloomberg article-level paywall, some Lancet/NEJM articles.

#### `is_verified` semantics

| Tier | `is_verified` | Why |
|---|---|---|
| Tier A success | `true` | URL resolved, content matches |
| Tier B success | `true` | URL resolved (via real browser), content matches |
| Tier C (snippet only) | `false` | URL not actually fetched at content level |
| Any tier failure with no fallback | `false` | URL unverifiable |
| Tier B unavailable (Playwright not installed) | `false` + tag `tier-b-unavailable` | Operator must rerun verification later |

The `paywalled-source` tag distinguishes "intentionally fell back to snippet" from "verification failed entirely."

#### Hard rules (carry over)

- Skip the event entirely if no tier succeeds and no snippet is identifiable. Do **not** invent a different URL. Do **not** approximate based on the publication's typical slug format.
- The `events.source_url_hash` unique index prevents duplicate URL inserts but does **not** validate that URLs resolve. URL verification is the agent's responsibility.

The reason this matters: past pipeline cycles accumulated dead links — both AI-hallucinated URLs (model guessed a plausible slug that never existed) and real-but-rotted URLs (paywall, deletion, slug change), AND real-but-unfetchable URLs that the WebFetch-only mechanism silently excluded. The dashboard's intelligence feed is only useful if every "SOURCE ↗" link works and the source set is not silently narrowed by tool-layer limits. The three-tier mechanism prevents both rot and bot-protection exclusion.

### 5. Write

> **Operator-revise loop:** any event the agent writes is a draft. The operator may revise it after publish. When the agent re-encounters its own past writes on subsequent cycles (reading `events`, `cases.dossier`, prior `snapshots`), it does **not** treat them as ground truth for interpretation — see `## Write-time rigor for sig-4+ items` §C.

**Always upsert today's `outbreak_timeline` row at the end of each cycle.** The dashboard's left-rail timeline reads from this table — one row per day, `(disease, day_num)` is the unique key. `day_num` increments daily from Day 1 (the cluster-surfacing day; MV Hondius outbreak Day 1 = 2026-05-01). `snippet` is one short line (~70 chars) summarizing what happened that day. Pattern:

```sql
INSERT INTO outbreak_timeline (disease, day_num, occurred_on, snippet)
VALUES ('hantavirus', <day_num>, '<YYYY-MM-DD>', '<short snippet>')
ON CONFLICT (disease, day_num)
DO UPDATE SET snippet = EXCLUDED.snippet, updated_at = now();
```

The cycle can revise the snippet as the day progresses; the rail surfaces the latest version. Goal: at-a-glance Day-N chronology of the outbreak, distinct from event-level detail (which the EventFeed handles) and snapshot prose (SituationBrief headline + ai_analysis).

For each processed item:

> **Always set `events.source_author` to the actual publication name** (e.g. `'Reuters'`, `'CNN'`, `'Politico'`, `'NPR'`, `'NL Times'`, `'WHO'`, `'CDC'`, `'PHAC'`). The dashboard's EventCard renders `source_author` as the source label; without it the feed falls back to `source_type`'s generic enum value (`'google_news'`) and the publication identity is lost. This applies to every event, not just sig-4+.

```
INSERT events (with extracted fields)

If fact-check produced a new confirmed/corroborated fact:
  INSERT or UPDATE facts (UNIQUE (disease, title) is idempotent guard)

If case-related (new MVH-### or CH-### or contact dossier):
  UPDATE or INSERT cases (status, dossier append at end)
  INSERT case_locations rows for any new movement

If country-level case count changed:
  UPSERT country_stats (cases, deaths, latest_case_date)
  -- TREATMENT-SITE RULE: see "Country attribution: treatment site vs outbreak country" below.

INSERT scrape_log row (source, results_found, events_created, duplicates_skipped, error?, duration_ms)
```

For sig-4+ events, see `## Write-time rigor for sig-4+ items` §A (verbatim quote required), §A.2 (`primary-source` vs `paraphrased` tagging), and §E (populate `events.agent_notes` for events carrying `binary-policy`, `policy-ambiguity`, `paraphrased`, or `policy-clarification`).

After writing, **every 4th cycle** (or immediately on a sig-5 event):

```
Aggregate fresh totals from cases (filtered by case_class) + country_stats.
Compare to last snapshot.
If material change:
  INSERT snapshots (
    total_cases,         -- cases.filter(case_class IN confirmed/probable/suspected).length
    total_deaths,        -- cases.filter(status='deceased').length
    total_contacts,      -- cases.filter(case_class IN contact/returnee).length
    countries_affected,  -- count of distinct countries involved (incl. contact-tracing reach)
    countries_list,      -- ISO codes of involved countries
    fatality_rate,       -- total_deaths / total_cases (use cases denominator, not all-tracked)
    trend, trend_description, risk_level,
    headline,            -- ONE SHORT LINE (~100 char) sit-rep headline, surfaces top of SituationBrief
    ai_analysis,         -- 2-4 paragraph prose narrative — what changed, what to watch
    key_developments[]   -- bullet facts (existing pattern)
  )
```

**SituationBrief renders three tiers — fill all three:**
- `headline` is the one-line punch. "Day 11 — Dispersal monitoring phase begins. Three U.S. confirmed (Omaha + Atlanta), all isolated, none critical." Not the same as `trend_description` (which is a short trend label like "stable / accelerating / declining + brief context").
- `ai_analysis` is the prose body — 2-4 short paragraphs in plain language (no tech jargon, no Cred-Tier-2 / binary-policy / amplification). Closes with a "what we're watching" paragraph.
- `key_developments` is the bullet list of concrete facts (existing pattern — what most snapshot writers already produce well).

Avoid duplication: the headline names the phase; the prose explains what's happening and what to watch; the bullets give the concrete facts that ground both.

**Audience — non-negotiable:** the SituationBrief is read by visitors of hantavirustracer.com (the public-facing dashboard), not by the agent operating the pipeline. Write `headline`, `ai_analysis`, and `key_developments` as a **public-health brief for a curious member of the public** — what's happening with the outbreak today, what changed, what to watch. NEVER write about pipeline internals, schema changes, dashboard refactors, count formulas, runbook updates, or anything else that describes operator-side work. If a sentence would read at home in a `git commit` message or a code-review comment, it does NOT belong in the snapshot.

Bad (snapshot once contained these — DO NOT repeat):
- "Monitoring math fix: the dashboard now counts SUM(person_count) instead of COUNT(*)..."
- "Map color rule corrected: deaths now bump to red regardless of case count..."
- "New cohort row ES-MAD-NEG-GROUP added to track 13 negative Spanish returnees..."

Good (what the headline should sound like):
- "May 11 — Spain confirms its first national case; 12 Dutch hospital staff quarantined after protocol breach"
- "May 10 — MV Hondius docks at Tenerife; managed disembarkation underway in nationality groups"
- "May 8 — WHO upgrades global risk from very low to low; Switzerland reports first European confirmed case"

If you fix data or schema in the same write that touches a snapshot, the snapshot prose should describe **what the data now says about the outbreak**, never **what you changed about how it's stored**.

### Country attribution: location-based counts

`country_stats.cases` and `country_stats.deaths` are derived by **grouping cases on `cases.current_country`** — where the patient physically is. Where a patient holds citizenship is not the question; the map colors what's happening *inside* each country. A confirmed-case patient in a JNB hospital is a South African outbreak data point because the disease is physically present there, full stop.

**The rule:**

| What the country has | country_stats | Map color |
|---|---|---|
| At least one death (cases.status='deceased') | `deaths > 0` | **Red** |
| At least one confirmed or probable case, no deaths | `cases > 0`, `deaths = 0` | **Orange** |
| Only suspected cases (no confirmed/probable yet) | `cases = 0`, `status = 'monitoring'` | **Teal** |
| Only contacts/returnees (case_class IN contact/returnee) | `cases = 0`, `status = 'monitoring'` | **Teal** |
| Nothing | absent or all zeros | no color |

Deaths beat confirmed/probable beat suspected beat contacts. **Suspected cases do NOT make a country orange** — they keep the country in monitoring (teal) until lab confirmation moves them to confirmed or probable. The map color logic is in `lib/map-colors.ts → countryBucket()` and mirrors this exactly. No heat-bucket scaling by case count — the user-facing distinction that matters is presence vs absence, not magnitude.

**Recounting country_stats after a cases write:**

```sql
-- Zero out first
UPDATE country_stats
SET cases = 0, deaths = 0,
    status = CASE WHEN status = 'active' THEN 'monitoring' ELSE status END
WHERE disease = 'hantavirus';

-- Then rebuild from cases.current_country
UPDATE country_stats cs
SET cases = c.case_count,
    deaths = c.death_count,
    status = CASE
      WHEN c.death_count > 0 THEN 'active'
      WHEN c.case_count > 0 THEN 'active'  -- confirmed or probable only
      WHEN c.suspected_count > 0 THEN 'monitoring'  -- suspected stays teal
      ELSE cs.status
    END
FROM (
  SELECT
    current_country AS country_code,
    COUNT(*) FILTER (WHERE case_class IN ('confirmed_case','probable_case')) AS case_count,
    COUNT(*) FILTER (WHERE case_class = 'suspected_case') AS suspected_count,
    COUNT(*) FILTER (WHERE status = 'deceased') AS death_count
  FROM cases
  WHERE disease = 'hantavirus' AND current_country IS NOT NULL
  GROUP BY current_country
) c
WHERE cs.country_code = c.country_code AND cs.disease = 'hantavirus';
```

When a patient transfers between countries (e.g., medevac, repatriation flight), update `cases.current_country` and re-run the recount. The country they left now reflects their absence; the country they arrived at reflects their presence.

`snapshots.total_deaths` continues to derive directly from `cases.status='deceased'` aggregation. Country attribution doesn't affect the headline death count.

**Note on the `cases.nationality` column:** the column exists (per migration `20260511030000_cases_nationality.sql`) and is backfilled, but country_stats does **not** use it. It's available as descriptive metadata if a future view wants to break down cases by nationality, but the map and the case counts are location-based.

**Active outbreak countries (2026 MV Hondius, current):**
- Red (deaths): SH (2 cases, 1 death), ZA (2 cases, 1 death), CV (1 case, 1 death)
- Orange (cases): US (3 cases), NL (2 cases), CH (1 case), ES (1 case)
- Teal (monitoring): all others with contacts/returnees only

### Snapshot counts from live tables

**Always derive snapshot counts from the live tables** — never write arbitrary numbers. Three derivations to do at snapshot time:

```sql
-- total_cases — confirmed/probable/suspected only, person-count-aware
SELECT SUM(person_count) FROM cases
WHERE disease='hantavirus' AND case_class IN ('confirmed_case','probable_case','suspected_case');

-- total_contacts — contacts and returnees only, person-count-aware
SELECT SUM(person_count) FROM cases
WHERE disease='hantavirus' AND case_class IN ('contact','returnee');

-- total_deaths — deceased status across any case_class
SELECT COUNT(*) FROM cases
WHERE disease='hantavirus' AND status='deceased';

-- countries_affected + countries_list — every country touched, including
-- contact-tracing reach (active + monitoring rows in country_stats)
SELECT COUNT(*) AS countries_affected,
       array_agg(country_code ORDER BY country_code) AS countries_list
FROM country_stats WHERE disease='hantavirus';
```

**Person-count-aware counting:** `total_cases` and `total_contacts` use `SUM(person_count)` rather than `COUNT(*)`. Most case rows have `person_count = 1`, but cohort rows like `US-NE-GROUP` (15 Americans), `NL-RAD-GROUP` (12 Radboud staff), `ES-MAD-NEG-GROUP` (13 Spanish returnees) represent multiple individuals in a single row. Without `SUM(person_count)`, the TopBar chips and KPI tiles dramatically undercount the actual population under monitoring. The dashboard's TopBar and KpiHud / KpiGrid use `lib/case-helpers.ts → sumPersons()` for the same rollup. See migration `20260511040000_cases_person_count.sql`.

The UI derives from these tables for live counts; if the snapshot disagrees with the derived number, panels disagree. **`countries_affected` includes contact-tracing reach** — it is NOT just countries with confirmed cases. Undercounting (e.g., listing only the 10 primary-affected countries when 20 total appear in `country_stats`) makes the KPI HUD lie. Past failure mode: a snapshot writer counted "primary affected" countries instead of all rows; observed 2026-05-10 with `countries_affected=10` while `country_stats` had 20 rows and the top header read 20 — KPI HUD and header disagreed by 2x.

#### Cycle output expectations (write density)

**Per-URL evaluation rule.** For each unique URL surfaced via search that materially advances the story, the agent considers whether it warrants its own event row. **Default to writing rather than consolidating.** Per-country operational events (Spain flight to Madrid, Dutch charter, UK UKHSA flight, etc.) surface as distinct dashboard cards; one batched "multi-nation repatriation" row hides the operational detail the dashboard exists to surface. The verbatim-quote and agent_notes overhead from §A and §E does not justify consolidation — the dashboard prefers many lean cards over few fat rows.

**Floor (not target):** if a cycle writes **fewer than ~3 sig-3+ events during an active-event phase**, re-examine the search results before closing — the cycle is likely under-producing. There is no upper-bound target; pushing thin events to hit a count is the opposite failure mode.

**Anti-pattern: verification-mode framing.** Pipeline cycles have historically under-produced when the agent treats them as "smoke tests" or "demonstrations of the rules" rather than full operational runs. If you find yourself reasoning about an event in terms of "does this demonstrate Rule X firing?" rather than "is this material to the story?" — recalibrate. Every cycle is a real run.

## Write-time rigor for sig-4+ items

These rules apply when an event's `significance` is 4 or 5. They reduce framing drift; they do not eliminate it (see "Residual drift" below).

### A. Verbatim quote requirement

The agent's `events.summary` for any sig-4+ event must contain at least one direct quote from the source, in unicode quotes (`'…'`). The quote pins the source's actual language next to the agent's interpretation. SQL-escape concerns belong at the query-construction layer, not in the content convention.

**Example (clean state):**

> Per CDC clarification (May 9): 'we are not quarantining anybody'.

**Example (contested state, demonstrates A + A.2 + B firing together):**

> Summary: CDC press release: 'CDC will coordinate the safe repatriation… American citizens are being repatriated to Offutt Air Force Base'. Per ABC News reporting a CDC clarification (May 9): 'we are not quarantining anybody'.
> Tags: `['policy-ambiguity', 'paraphrased', 'cdc', 'mv-hondius', ...]`
> Significance: 5 (policy importance unchanged)

The verbal-clarification quote is attributed via ABC News (journalist-mediated), not directly to CDC. That's why the event carries `paraphrased`, not `primary-source`.

### A.2 Attribution tagging

Every sig-4+ event also gets one attribution tag describing where the quote came from:

- `tags: ['primary-source', ...]` — quote is from the agency's own publication (press release, DON, statement, dashboard).
- `tags: ['paraphrased', ...]` — only a journalist's report exists; quote is framed as "[Outlet]: 'agency said X'" rather than the agency's direct voice.

**Tie-breaker:** if any quote in the summary is journalist-mediated, the event tags `paraphrased` (weakest-link attribution wins). An event with both an agency-direct quote AND a journalist-mediated quote tags `paraphrased`.

Attribution metadata only. URL verification is separate (handled by §4.5 — `is_verified` covers URL existence, the new tags govern attribution).

### B. Opposing-search (binary policy claims)

For any binary policy claim — mandatory/voluntary, banned/allowed, confirmed/denied, will/may, declared/withdrawn — the agent must run **two searches**: the affirmative and the negation.

**"Substantive results"** means at least one Cred Tier-1 or Cred Tier-2 source making the opposing claim (per `## Source credibility tiers` below). Social-media speculation does not count.

**Tag at write time, regardless of search outcome:** the event gets the `binary-policy` tag whenever Rule B's opposing-search procedure fires. This is the trigger for Rule D (follow-up agency-channel checks) on subsequent cycles. The tag is set whether or not the negation returned substantive results — `binary-policy` means "Rule B procedure ran on this event," not "framing was contested."

If the negation returns substantive results, **significance still reflects topic importance** (do not downgrade — that would hide a major policy story behind the SIGNAL tab). Instead the agent:

1. Includes both verbatim quotes side-by-side in the summary.
2. Tags `policy-ambiguity` (in addition to `binary-policy`).
3. Does not pick a side without operator input.

If the negation returns nothing substantive: event proceeds with `binary-policy` tag only (no `policy-ambiguity`).

### C. Don't trust your own past writes

The agent treats all dossier text and prior event summaries as **agent-authored prior writes** — never as ground truth for interpretation. On every cycle, re-verify framing against current sources. Do not preserve framing solely because the DB already contains it. If the source language has shifted, propose an UPDATE softening or correcting the prior dossier/summary.

This is the operator-revise-loop in agent-actionable form. There is no marker convention for "operator-confirmed text" in v1 — the rule applies uniformly to all DB content the agent re-encounters.

### D. Follow-up agency-channel checks (events tagged `binary-policy`)

For any event tagged `binary-policy` with an agency-name tag (cdc, who, ecdc, ukhsa, rivm, rki, sanidad, etc.), the agent on every subsequent cycle within the re-check window performs follow-up channel checks against that agency.

#### Re-check window

Starts at original event's `created_at`, runs 7 days. Each Rule D clarification UPDATE on this event extends the window 7 days from the clarification's `created_at`. Window queryable from `events.created_at` and `clarifies:<uuid>` tag chains:

```sql
-- find in-window binary-policy events that need Rule D this cycle
SELECT e.id, e.created_at, e.tags
FROM events e
WHERE 'binary-policy' = ANY(e.tags)
  AND (
    e.created_at > now() - INTERVAL '7 days'
    OR EXISTS (
      SELECT 1 FROM events c
      WHERE 'clarifies:' || e.id::text = ANY(c.tags)
        AND c.created_at > now() - INTERVAL '7 days'
    )
  );
```

#### Preflight (cost control)

Before deep channel-check on an in-window event, query `scrape_log` for entries with the matching agency `source_type` since the last Rule D check on this event (or since original event creation if never Rule-D-checked). If nothing new from that agency, skip the deep check this cycle.

This collapses Rule D's per-cycle cost from `~5 channels × ~10 in-window events = ~50 fetches` to "preflight read of `scrape_log` + only deep-check events with new agency activity."

#### Channels checked when preflight indicates new activity

- Press releases / official statements page
- Periodic press-briefing transcripts
- Press-conference video/audio coverage by Cred Tier 1-2 outlets within 48h
- Official social media (X/Twitter primarily)
- For US federal events:

  ```
  site:politico.com OR site:axios.com OR site:thehill.com
    "<agency name>" "<policy keyword from original summary>"
    after:<original_event.created_at>
  ```

  where `<policy keyword>` is the actual binary-policy term from the original summary ("quarantine", "mandatory", "ban", "withdrawn", etc.) that triggered Rule B.

#### Action on detection

If any channel surfaces a clarification, contradiction, softening, strengthening, or reversal:

1. **Insert** a clarification event with tags `['policy-clarification', 'clarifies:<original-uuid>', <agency>, ...]`.
2. **UPDATE** the original event reframing it to match the agency's most recent statement — softening, strengthening, or rephrasing as warranted.
3. The original event already carries `binary-policy`; the clarification event does not need it unless the clarification is also a binary policy claim.

#### Linking convention

No `related_event_id` schema column. Clarification chains live in tags:

- Clarification event tags include `clarifies:<uuid-of-original>`.
- Reverse lookup: `SELECT * FROM events WHERE 'clarifies:' || $1 = ANY(tags)`.
- Operator can grep `clarifies:` in feed view to spot chains.

### Tags introduced by this section

| Tag | Meaning |
|---|---|
| `primary-source` | Quote in `events.summary` is from the agency's own publication (press release, DON, statement, dashboard). See §A.2. |
| `paraphrased` | Only a journalist's report exists; quote is "[Outlet]: 'agency said X'" rather than the agency's direct voice. Weakest-link tie-breaker per §A.2. |
| `policy-ambiguity` | At original write time, two contradictory framings existed across Cred Tier 1-2 sources. Both quotes shown side-by-side. See §B. |
| `binary-policy` | Rule B's opposing-search procedure fired on this event. Drives Rule D re-checks. See §B and §D. |
| `policy-clarification` | This event clarifies, contradicts, softens, strengthens, or reverses an earlier event from the same agency. Linked via `clarifies:<uuid>`. See §D. |
| `clarifies:<uuid>` | Linkage tag pointing from a clarification event to the original event. UUID matches `events.id`. See §D. |
| `paywalled-source` | Event sourced from search snippet because Tier C verification (paywall) blocked full fetch. See §4.5. |
| `tier-b-unavailable` | Tier B verification failed because the Playwright MCP server was unavailable in the operator session. Operator must rerun verification later. See §4.5. |
| `requires-corroboration` | Cred Tier 3-4 source only; corroboration search returned nothing from Cred Tier 1-2. Held at sig-2. See §1 corroboration vs opposing search. |

### E. agent_notes — internal reasoning trail

For events carrying any of these tags:

- `binary-policy`
- `policy-ambiguity`
- `paraphrased`
- `policy-clarification`

the agent populates the `events.agent_notes TEXT NULL` column with **one sentence** capturing whatever the operator most needs to evaluate this row on sight — typically: what tier the source verified at, what Rule B's opposing-search returned, and (for binary-policy events) what Rule D will re-check. Aim for a single line; if you find yourself writing a paragraph, the §E note has drifted into rationale-for-the-record territory and needs trimming. Lean notes preserve density without forcing thin writes.

**Examples of the right length:**

- `Tier A curl 200; Rule B opposing-search nothing; binary-policy tagged for Rule D 7-day window.`
- `Tier C snippet — Hill blocked at A (403) and B (Access denied); paywalled-source.`
- `Newsweek (Tier 2) corroborates earlier tabloid surfacing; requires-corroboration not applied.`

Routine descriptive primary-source events (most WHO DONs, CDC HAN updates) do **not** get notes — `agent_notes` stays NULL. The trigger condition is narrow on purpose.

`agent_notes` is internal-only at the REST layer. Public dashboard surfaces (EventCard, map drawer, OG image) project explicit columns via `EVENT_PUBLIC_COLUMNS` (`lib/types.ts`) and exclude this one. Operator reads via `supabase db query --linked`:

```bash
supabase db query "SELECT id, summary, agent_notes FROM events WHERE id = '<uuid>';" --linked
```

#### Example 1 — `policy-clarification` event (Rule D fire)

```
events.summary:
  Per CDC clarification (May 9): 'we are not quarantining anybody'.

events.tags:
  ['policy-clarification', 'clarifies:7a3c-...', 'cdc', 'paraphrased',
   'mv-hondius']

events.agent_notes:
  Original event 7a3c-... written from CDC press release language. Rule D
  fired on cycle 14 (May 9 14:00 UTC) when ABC News surfaced verbal
  clarification at White House gaggle. Group 4 (Politico) confirmed
  within 4h. Cred Tier 1-2 corroboration satisfied; original event
  UPDATEd, this clarification inserted.
```

#### Example 2 — `binary-policy` event with no Rule B contradiction at write time

```
events.summary:
  Spanish Health Minister at press conference (May 8): 'Mandatory
  monitoring will be implemented for all returnees from the affected
  region for 14 days'.

events.tags:
  ['binary-policy', 'sanidad', 'primary-source', 'mv-hondius']

events.agent_notes:
  Rule B opposing-search ran "voluntary monitoring Spain MV Hondius" -
  no Cred Tier 1-2 contradicting framing surfaced. Single primary-source
  framing held. Event tagged binary-policy so Rule D will re-check
  Sanidad's channels for 7 days from now. No policy-ambiguity tag
  (no contradiction at write time).
```

The second example demonstrates the common case: Rule B fires (binary policy claim), opposing-search returns nothing, event proceeds normally with `binary-policy` tag (which arms Rule D). This is the failure mode the original CDC quarantine case missed entirely.

#### Realtime publication: narrowed to match REST projection

`EVENT_PUBLIC_COLUMNS` narrows REST queries; the `supabase_realtime` publication's column filter on `events` (migration `20260510010000_realtime_publication_narrow_events.sql`) narrows the WebSocket broadcast to the same 22 columns. `agent_notes` is excluded from both channels.

The publication's column list (Postgres 15+ column-filter syntax):

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.events (
  id, created_at, occurred_at, title, summary, raw_content,
  source_type, source_url, source_author, significance, category,
  country_code, region, location_name, latitude, longitude,
  case_count, death_count, is_verified, tags, duplicate_of, disease
);
```

If a new public column is added to `events` later, both `EVENT_PUBLIC_COLUMNS` (REST projection in `lib/types.ts`) and the publication's column list (Realtime broadcast) must be updated together — they're two surfaces of the same "what's public" question. If you add an internal column like a future `internal_notes`, leave it out of both.

### Explicit non-goals

Future sessions reading this section will be tempted to extend the rules. The following extensions are deliberately out of scope:

- **Blanket multi-source corroboration.** Wire services routinely echo the same press release with the same framing; two outlets reporting the same agent-extracted summary is not independent corroboration. The rule also adds latency on Tier-1 primary statements (WHO DON, ECDC TAB, CDC HAN) which are themselves the source. Rules A and B handle the failure mode without this cost.
- **UI signal for the `paraphrased` tag (v1).** The tag is operator-on-sight-in-the-feed only. No EventCard tone change, no inline footnote, no SIGNAL-tab integration. If drift turns out to need stronger visual surfacing, that's a separate frontend sub-project.
- **Marker convention for operator-confirmed text.** Adds a convention the operator must remember; partial adoption is worse than uniform skepticism. Rule C ("agent treats all prior DB writes as agent-authored, re-verify on every cycle") is more honest about what's enforceable today.
- **Machine-verification of verbatim quotes against source URLs.** Succeeds on plain HTML and silently fails on paywalls, dynamic content, PDFs, image-only documents, embedded video transcripts. False confidence on the cases where it works is more dangerous than uniform skepticism. The verbatim-quote rule's value is the side-by-side framing for the operator's eye, not a machine-checkable invariant.
- **Further schema changes beyond §E.** The May-10 amendment introduced the `events.agent_notes` TEXT NULL column for §E (internal-only reasoning trail) and the `scrape_log.source_type` group:* convention for §1 rotation. No additional columns, no new enum values, no further migrations are contemplated by this section. Anyone reaching for `supabase/migrations/` to add more is over-extending.

### Residual drift, framed honestly

Three rules + a non-scope list will reduce framing drift. They will not eliminate it.

The CDC framing miss that prompted this work had two layers:

The first was an over-extrapolation at write time — the press release said "available for evaluation/monitoring" and the agent collapsed that into stronger "for quarantine and monitoring" framing. Rule A (verbatim quote required) is designed to make exactly that collapse structurally hard. With the rule in place, the agent's summary would have had to pin the source's actual neutral language next to whatever interpretation it added — and the over-extrapolation would have been visible to the operator on sight.

The second was source-internal contradiction across channels — the verbal clarification reversed the mandatory tone hours after the press release. No write-time rule the pipeline could apply prevents that. At the moment of the agent's write, the press release was the only available source and reading it neutrally was the most defensible interpretation; the contradiction was published after the agent's write.

The operator feedback loop is the only cure for the second layer. Sessions that read this runbook should expect to revise their own past writes regularly — that's the system working as intended, not the system breaking.

## UI output coverage map

Every dashboard surface is fed by one or more of the writes above. Use this map to verify a cycle's writes will refresh everything that should refresh:

| UI surface | Table | Field(s) read |
|---|---|---|
| TopBar pandemic-probability chip + threat level | `threat_assessments` | latest row: `pandemic_probability`, `threat_level` |
| TopBar CASES chip | `cases` (live filter) | `case_class IN (confirmed_case, probable_case, suspected_case)` |
| TopBar DEATHS chip | `snapshots` | latest `total_deaths` |
| TopBar MONITORING chip | `cases` (live filter) | `status = 'monitoring'` |
| TopBar VIEWING chip | (presence channel) | live websocket count |
| TopBar UTC + RISK chips | system + `snapshots` | system clock + `risk_level` |
| Situation Brief — TREND label + headline | `snapshots` | `trend` + `trend_description` |
| Situation Brief — bullets | `snapshots` | `key_developments[]` |
| Assessment narrative + reasoning | `threat_assessments` | `summary`, `reasoning` |
| Assessment KEY SIGNALS pills | `threat_assessments` | `r0_estimate`, `mutation_status`, `secondary_attack_rate`, `containment_effectiveness` |
| Assessment Polymarket grid | `threat_assessments` | `polymarket_pandemic_odds`, `polymarket_us_case_odds`, `polymarket_vaccine_odds`, `polymarket_lab_leak_odds` |
| Assessment AI vs market note | `threat_assessments` | `ai_vs_market_note` |
| Assessment triggers | `threat_assessments` | `triggers_watching[]`, `triggers_tripped[]` |
| Map — country choropleth | `country_stats` | `cases`, `status` |
| Map — case markers | `cases` + `case_locations` | latest `currentLocation` per case |
| Map — Palantir trace | `case_locations` | full timeline ordered by `arrived_at` for selected case |
| KPI HUD CASES tile | `cases` (live filter) | `case_class IN (confirmed_case, probable_case, suspected_case)` |
| KPI HUD CONTACTS tile | `cases` (live filter) | `case_class IN (contact, returnee)` |
| KPI HUD DEATHS / FATALITY / COUNTRIES | `snapshots` | `total_deaths`, `fatality_rate`, `countries_affected` |
| Map subtitle | derived | `caseCount · contactCount · countries.length` |
| BY COUNTRY tab | `country_stats` | full table sorted by severity |
| Watchlist (right column alerts) | `events` | `significance >= 3`, ordered by `created_at` DESC |
| Monitoring Cohort | `cases` | `status = 'monitoring'`, with ALL/CONTACTS/RETURNEES filter on `case_class` |
| Posture Matrix (Countries Affected) | `country_stats` | full table sorted by deaths/cases/status |
| Virus Profile | `facts` | rows with `category IN (pathogen, transmission, clinical)` and `key:*` tags |
| Case dossier drawer | `cases` + `case_locations` + linked `events` | full dossier when a case is opened |
| Intelligence feed (horizontal ticker) | `events` | filtered by tab (`?tab=`) |
| OG image | `snapshots` | `total_cases`, `total_deaths`, `countries_affected`, `risk_level` |
| `scrape_log` (operator-only) | `scrape_log` | per-cycle stats |

**Rule of thumb:** if a cycle adds an event, write it. If it changes case classification or status, update the case row. If country totals shift, upsert `country_stats`. If aggregate totals or trend changes materially, insert a new `snapshots` row. If the threat picture shifted, insert a new `threat_assessments` row (per §4 of "Threat assessment cycle"). One cycle can write to all five tables; usually it writes to one or two.

## Source credibility tiers

| Tier | Examples |
|---|---|
| **1 (highest)** | WHO, CDC, ECDC, Africa CDC, national health ministries, peer-reviewed (Lancet, NEJM, Nature, JAMA) |
| **2** | Major wire services (Reuters, AP), established medical journalists, university research labs |
| **3** | Major news outlets (NYT, BBC, Guardian), verified medical professionals on social media |
| **4** | Reddit threads, unverified social media, blogs, Wikipedia (early-signal only, never confirmation) |

## Confidence scoring

| Range | Meaning |
|---|---|
| **0.95–1.0** | WHO/CDC official statement, peer-reviewed data |
| **0.85–0.95** | Multiple Tier 1–2 sources agree |
| **0.70–0.85** | Tier 2 source + corroboration |
| **0.50–0.70** | Single credible source, no contradiction |
| **0.30–0.50** | Unverified but plausible |
| **< 0.30** | Don't store as a fact; events table only |

## Fact maintenance

Every 6–12 hours during active monitoring:

1. Walk all `unverified` facts. Has new evidence emerged? → upgrade or remove.
2. Walk all `corroborated` facts. Has an official source confirmed? → upgrade.
3. Check whether any `confirmed` fact has been contradicted. → mark `disputed`.
4. Update `last_verified_at` on facts that re-confirmed.
5. Refresh the snapshot row with current aggregates.

When you supersede a fact:
- Set old fact's `verification_status='retracted'`
- Set old fact's `superseded_by = <new fact id>`
- INSERT the new fact normally

## Cross-referencing case dossiers

When updating `cases.dossier`, reference confirmed facts by title:

> "Confirmed ANDV via RT-PCR (see fact: *Causative agent identified as Andes orthohantavirus (ANDV)*)"

Never include unverified claims in dossiers. Only `confirmed` or `corroborated`.

## PII rule

**Never write real names to the database.** Use case codes (MVH-001, CH-001) in dossiers and event summaries. If a source mentions a name, anonymize in your write.

## Dossier append format

When updating an existing case dossier, don't rewrite from scratch. Append:

```
[Updated 2026-05-08 14:00 UTC] Swiss authorities confirm patient stable on oxygen support; no ventilation required.
```

## Snapshot AI-analysis style

Write the `ai_analysis` field as if briefing a decision-maker — concise, factual, forward-looking. What changed, what it means, what to watch for. ~3–6 sentences. Same voice as the existing seed snapshot.

## Error handling

| Error | Response |
|---|---|
| Source unreachable | Log error in `scrape_log`, continue to next source. Retry on next cycle. |
| X rate limited | Back off X for 30 min. Continue with other sources. |
| Supabase write fails | Retry once. If still fails, log error and surface in chat. |
| Chrome disconnected | Log error, fall back to non-X sources, alert user to reconnect. |
| Conflicting Tier-1 sources | Mark fact `disputed`. Surface in chat. Don't pick a winner without operator input. |

## Surge triggers

Switch to 5–10 min cycle cadence on:

- New country reports a case
- WHO press briefing or new DON entry
- Death-count change
- Confirmed mutation
- Border closure or major travel advisory change

## Session-end checklist

When you stop a Claude session:

1. Run one final cycle.
2. Confirm `scrape_log` shows the last cycle's row.
3. Note in chat the most recent `events.created_at` timestamp so the next session knows where to resume.

---

## Threat assessment cycle

Runs once per pipeline cycle, **after** scrape/dedupe/fact-check/write — when you have the latest event/case/fact picture and are about to wrap up.

### 1. Fetch Polymarket odds

For each of the four watched markets, hit:
```
GET https://gamma-api.polymarket.com/events?slug=<slug>
```
No auth. The YES price lives in `markets[0].outcomePrices` (a JSON-encoded array paired with `markets[0].outcomes`). Markets to fetch:

| Slug | Field on `threat_assessments` |
|---|---|
| `hantavirus-pandemic-in-2026` | `polymarket_pandemic_odds` |
| `confirmed-case-of-hantavirus-in-us-by-may-15` | `polymarket_us_case_odds` |
| `hantavirus-vaccine-in-2026` | `polymarket_vaccine_odds` |
| `hantavirus-lab-leak-confirmed-by-june-30-1` | `polymarket_lab_leak_odds` |

If any market 404s or returns no price, write `NULL` for that column and continue.

### 2. Re-evaluate triggers

Walk the list in `lib/threat-triggers.ts` (`TRIGGERS`). For each, check evidence in cases / events / facts written *since the last threat_assessments row*:

- `airborne_transmission` — any case with no close-contact path?
- `r0_above_one` — does the latest R0 estimate exceed 1?
- `doubling_48h` — case count doubled within last 48h?
- `spike_mutation` — new ANDV strain with Gn/Gc spike mutations confirmed?
- `no_known_exposure` — confirmed case lacking a documented exposure path?
- `who_above_low` — WHO published "moderate" or higher?
- `cdc_above_level3` — CDC raised travel notice past Level 3?
- `community_transmission` — case outside the index-contact graph?
- `twenty_countries` — distinct country count ≥ 20?

For each trigger, classify as `watching` (still monitoring, no evidence) or `tripped` (evidence in current cycle).

### 3. Reassess pandemic_probability

Compose:
- `pandemic_probability` (0–1) and matching `threat_level` (use the threshold table).
- `summary` — 1–3 sentences.
- `reasoning` — paragraph including R0, mutation status, SAR, key historical comparators (El Bolsón 1996, Epuyén 2018), and an explicit note about why you diverge from Polymarket consensus if you do.
- `r0_estimate`, `mutation_status`, `secondary_attack_rate`, `case_doubling_days`, `containment_effectiveness` — pin from current data.

**Audience — same rule as snapshot.ai_analysis.** `summary` and `reasoning` are read by visitors of hantavirustracer.com via the ThreatPanelExpanded component, not by the agent operating the pipeline. Write them as **public-health epidemiology prose for a curious member of the public**: what's happening with the outbreak, how dangerous it actually is, why we think so, how it compares to past ANDV outbreaks. NEVER write about pipeline internals, schema changes, snapshot derivations, count formulas, or anything else describing operator-side work. The audience rule from `## SituationBrief` applies here verbatim.

### 4. Decide whether to insert

Compare new `pandemic_probability` to the previous row's. INSERT a new `threat_assessments` row **only if**:

- `|new - last| > 0.01`, **OR**
- A trigger transitioned watching ↔ tripped, **OR**
- `threat_level` changed.

Otherwise skip — don't spam the table with identical rows. The dashboard reads `ORDER BY created_at DESC LIMIT 1`, so silence keeps the prior assessment displayed.

### 5. Provenance

Always set:
- `model` — current model id (e.g. `claude-opus-4-7`).
- `pipeline_session_id` — Claude session id, run id, or any string that lets us retrace which cycle produced the row.

## Case classification

Every `cases` row has two orthogonal columns:

- `status` — lifecycle: `monitoring | suspected | confirmed | recovered | deceased | critical`
- `case_class` — what the row represents:
  - `confirmed_case` — Tier-1 source explicitly says PCR-confirmed or lab-positive.
  - `probable_case` — Tier-1 source describes the case as probable / postmortem-positive / strong epi link without lab.
  - `suspected_case` — Symptomatic but neither lab-confirmed nor probable per source.
  - `contact` — Known direct exposure to a case but not yet symptomatic-and-tested.
  - `returnee` — Returned from an exposure area without known direct contact (precautionary).

When writing a new row, always set both. Allowed combinations:

- `confirmed_case` × `monitoring | recovered | deceased | critical`
- `probable_case` × `monitoring | recovered | deceased`
- `suspected_case` × `suspected | monitoring | recovered`
- `contact` × `monitoring | recovered` only — promote to `confirmed_case` if the contact tests positive
- `returnee` × `monitoring | recovered` only — same promotion rule

Promotion is operator-driven for now. If a contact tests positive, write an UPDATE that flips `case_class` to `confirmed_case` AND adjusts `status` accordingly. Do not leave a contact in `confirmed`/`deceased`/`critical` lifecycle states.

The dashboard counts:

- CASES = rows with `case_class IN (confirmed_case, probable_case, suspected_case)`
- CONTACTS = rows with `case_class IN (contact, returnee)`
- `country_stats.cases` is keyed on `current_country` (where the row is now), not exposure_country.

