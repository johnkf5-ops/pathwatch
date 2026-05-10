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

Sources, in order of priority:

| Source | Endpoint / query |
|---|---|
| **WHO DON** | https://www.who.int/emergencies/disease-outbreak-news — read for any new entries since last cycle |
| **CDC** | RSS https://tools.cdc.gov/api/v2/resources/media/rss — filter for hantavirus terms |
| **ECDC** | https://www.ecdc.europa.eu/en — search "hantavirus" |
| **Africa CDC** | https://africacdc.org/ — search "hantavirus" |
| **Google News** | search `"hantavirus 2026"` and `"MV Hondius"` |
| **Reddit** | https://www.reddit.com/r/{worldnews,medicine,epidemiology,health}/search.json?q=hantavirus&sort=new&t=day |
| **BlueSky** | search API for "hantavirus" |
| **X/Twitter** | via Chrome MCP — search `hantavirus OR "hanta virus" OR "MV Hondius" OR "andes virus"`, top 20–30 results since last scrape, 2–5 sec random delays between page loads |
| **Wikipedia** | https://en.wikipedia.org/wiki/MV_Hondius_hantavirus_outbreak — check for substantive edits |

Capture: URL, full text, author/handle, timestamp, engagement counts. Persist raw text in `events.raw_content`.

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
- For binary policy claims (mandatory/voluntary, banned/allowed, confirmed/denied, will/may, declared/withdrawn), see `## Write-time rigor for sig-4+ items` §B (opposing-search).

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

For each processed item:

```
INSERT events (with extracted fields)

If fact-check produced a new confirmed/corroborated fact:
  INSERT or UPDATE facts (UNIQUE (disease, title) is idempotent guard)

If case-related (new MVH-### or CH-### or contact dossier):
  UPDATE or INSERT cases (status, dossier append at end)
  INSERT case_locations rows for any new movement

If country-level case count changed:
  UPSERT country_stats (cases, deaths, latest_case_date)

INSERT scrape_log row (source, results_found, events_created, duplicates_skipped, error?, duration_ms)
```

For sig-4+ events, see `## Write-time rigor for sig-4+ items` §A (verbatim quote required) and §A.2 (`primary-source` vs `paraphrased` tagging).

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
    trend, trend_description, risk_level, key_developments[], ai_analysis
  )
```

**Always derive `total_cases` and `total_contacts` from the `case_class` filter on the live `cases` table** — never write arbitrary numbers. The UI also derives from `case_class` for live counts; if the snapshot disagrees with the derived number, panels disagree.

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

**"Substantive results"** means at least one Tier-1 or Tier-2 source making the opposing claim (per `## Source credibility tiers` below). Social-media speculation does not count.

If the negation returns substantive results, **significance still reflects topic importance** (do not downgrade — that would hide a major policy story behind the SIGNAL tab). Instead the agent:

1. Includes both verbatim quotes side-by-side in the summary.
2. Tags `policy-ambiguity`.
3. Does not pick a side without operator input.

### C. Don't trust your own past writes

The agent treats all dossier text and prior event summaries as **agent-authored prior writes** — never as ground truth for interpretation. On every cycle, re-verify framing against current sources. Do not preserve framing solely because the DB already contains it. If the source language has shifted, propose an UPDATE softening or correcting the prior dossier/summary.

This is the operator-revise-loop in agent-actionable form. There is no marker convention for "operator-confirmed text" in v1 — the rule applies uniformly to all DB content the agent re-encounters.

### Explicit non-goals

Future sessions reading this section will be tempted to extend the rules. The following extensions are deliberately out of scope:

- **Blanket multi-source corroboration.** Wire services routinely echo the same press release with the same framing; two outlets reporting the same agent-extracted summary is not independent corroboration. The rule also adds latency on Tier-1 primary statements (WHO DON, ECDC TAB, CDC HAN) which are themselves the source. Rules A and B handle the failure mode without this cost.
- **UI signal for the `paraphrased` tag (v1).** The tag is operator-on-sight-in-the-feed only. No EventCard tone change, no inline footnote, no SIGNAL-tab integration. If drift turns out to need stronger visual surfacing, that's a separate frontend sub-project.
- **Marker convention for operator-confirmed text.** Adds a convention the operator must remember; partial adoption is worse than uniform skepticism. Rule C ("agent treats all prior DB writes as agent-authored, re-verify on every cycle") is more honest about what's enforceable today.
- **Machine-verification of verbatim quotes against source URLs.** Succeeds on plain HTML and silently fails on paywalls, dynamic content, PDFs, image-only documents, embedded video transcripts. False confidence on the cases where it works is more dangerous than uniform skepticism. The verbatim-quote rule's value is the side-by-side framing for the operator's eye, not a machine-checkable invariant.
- **Schema changes.** No new columns, no new enum values, no migrations. The whole patch is markdown additions to this file plus tag-string conventions on `events.tags`.

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

