# Write-time rigor amendment — Design Spec

**Status:** Designed 2026-05-10. Pending implementation plan.
**Author:** Claude (cross-session brainstorm with the parallel pipeline-operator session)
**References:** Extends `docs/superpowers/specs/2026-05-09-write-time-rigor-design.md` (rules A, A.2, B, C and the §4.5 URL verification line). Read that spec first — the amendment does not restate its rules, only extends and corrects them.

---

## Why this amendment exists

The 2026-05-09 spec landed rules A, A.2, B, and C and tightened §4.5 with one explicit `is_verified` semantics line. Within 24h of that spec landing, three operational gaps surfaced:

1. **WebFetch-only verification cannot reach Reuters-class outlets.** Reuters, Bloomberg, WaPo, Bloomberg, and several other Tier 1-2 sources sit behind DataDome / similar bot-protection layers that return 401/403 to the WebFetch tool but render fine to a real browser. The original spec's `is_verified=true for resolved URLs, false otherwise` rule, applied to WebFetch alone, silently declares those outlets "dead URL" and excludes them. Real-world consequence: the 2026-05-08 events table repopulation excluded a real Reuters story (`new-hantavirus-case-suspected-remote-island-contact-tracing-continues`) as "dead" when it was simply unfetchable through the tool layer.

2. **The Scrape source list is too sparse to enforce the rules.** Original §1 names ~9 outlets; in practice the agent searches dozens. Without an explicit catalog and cadence convention, different sessions over-rely on different outlets, and Tier 3-4 stories sometimes propagate unchecked because no Tier 1-2 outlet got searched in the same cycle. The CDC quarantine miss surfaced exactly this failure mode — the verbal clarification was on Politico/Axios within hours, but those weren't in the agent's surfaced source set.

3. **Rule C ("don't trust your own past writes") is checklist theater without an operational instantiation.** Rule C tells the agent to re-verify framing on every cycle but doesn't specify *where* to look or *when* to re-fire. With no operational form, agents either re-fetch the same URL the original event cited (which has the same content and produces the same framing) or skip the rule entirely.

This amendment closes the three gaps with five structural items (§1-§4 below) and one honest scope adjustment (the migration line — see Scope honesty section).

---

## Scope honesty: migration line, partially relaxed

The original spec's `## Non-goals` ruled out schema changes. This amendment cannot hold that line cleanly. Rule D's clarification chains, agent_notes trace, and the rotation mechanism each fail or become checklist theater without minimal schema support. We add:

- **One nullable column:** `events.agent_notes TEXT NULL` — internal-only reasoning trail. Public UI never projects it.
- **One source_type value-space extension:** `scrape_log.source_type` accepts `group:<identifier>` values to support cycle-rotation queries.

Both are minimal, reversible, and additive — no existing rows changed, no NOT NULL constraints, no cascading effects. If the amendment proves wrong, both drop with no data loss.

Calling the amendment "no migration" would be dishonest scope-counting. Better to name the divergence and bound it.

---

## Naming convention (applies throughout this amendment)

The amendment introduces two distinct uses of the word "tier" that must not collide:

- **Credibility tiers** (source quality) — numeric **Tier 1 / 2 / 3 / 4** per existing pipeline.md `## Source credibility tiers`. Reuters is **Credibility Tier 1**.
- **Access tiers** (verification mechanism) — letters **Tier A / Tier B / Tier C**. Reuters is **Access Tier B** (Playwright-required).

A source's credibility tier and access tier are orthogonal. The amendment uses both terms in full ("Credibility Tier 1," "Access Tier B") wherever ambiguity is possible.

The implementation patch must rename any existing numeric "access tier" references in pipeline.md to letter form to prevent collision.

---

## §1 — Three-tier URL verification (replaces pipeline.md §4.5 mechanism)

### Current state and failure mode

The 2026-05-09 spec's §4.5 line said:

> set `is_verified=true` for resolved URLs, `is_verified=false` for events written from search snippets without a resolvable URL.

This wraps WebFetch's return value. WebFetch fails on bot-protected outlets that return 401/403 with DataDome / Cloudflare / similar protection layers, even though the URL is alive and the content is reachable through a real browser. Effect: every story sourced exclusively from Reuters, Bloomberg, WaPo, FT, etc. is silently downgraded to `is_verified=false` regardless of whether it exists.

### Three-tier mechanism

The agent attempts URL verification in this sequence, escalating only on detected failure patterns:

#### Tier A — curl (default)

`curl -s -L -A "<modern-browser-UA>" -o /dev/null -w "%{http_code}\n" <url>` followed by `curl -s -L -A "<modern-browser-UA>" <url> | head -c 8000` for content sniff.

Outlets in this tier (typical, illustrative): AP, AFP, BBC, NPR, ABC, NYT, Guardian, Reuters' Open data feeds, most national health agencies (cdc.gov, who.int, ecdc.europa.eu, etc.), most Tier 2-3 outlets without aggressive bot protection.

**Success:** HTTP 200 + content body contains expected article markers (title, byline, body text).
**Failure to escalate to Tier B:** HTTP 401/403, OR body contains DataDome/Cloudflare bot-challenge markers (`"Please enable JS"`, `<title>Just a moment...</title>`, `data-cf-beacon`, `dd_async_token`, etc.). Failure-pattern detection is signature-based, not heuristic.

#### Tier B — Playwright MCP (escalation)

When Tier A signatures match a bot-protection failure, agent calls Playwright MCP server tools (`browser_navigate`, `browser_snapshot`, `browser_evaluate` for body text extraction). Playwright runs a real browser, passes the bot-challenge, and returns rendered HTML.

Outlets typically requiring this tier: Reuters, Bloomberg, WaPo, Telegraph, some EU regional outlets (Le Monde, Der Spiegel articles behind their dynamic loaders).

**Success:** Playwright returns rendered article content, agent extracts body, verifies expected markers.
**Failure to escalate to Tier C:** Playwright returns paywalled content (login wall, partial preview only) AND no preview text matches the search snippet substantively.

**Operator-environment dependency:** Tier B requires the Playwright MCP server installed and authenticated in every pipeline operator session. This is documented in `docs/runbooks/pipeline-operator.md` as a pre-cycle checklist item. If Playwright is unavailable, agent records `is_verified=false` with tag `tier-b-unavailable` rather than silently escalating to Tier C — operator review captures the gap.

#### Tier C — snippet-only (final fallback)

True paywalls where Tier B's rendered content is still gated. Agent uses the search-result snippet text only, quotes verbatim into `events.summary`, sets `is_verified=false`, tags `paywalled-source`, and proceeds.

Outlets typically requiring this tier: FT, WSJ behind hard paywall, Bloomberg article-level paywall, some Lancet/NEJM articles.

The snippet is a smaller surface than full-article verification but is more honest than excluding the source entirely. The `paywalled-source` tag flags operator review.

### is_verified semantics, restated

| Tier | is_verified | Why |
|---|---|---|
| Tier A success | `true` | URL resolved, content matches |
| Tier B success | `true` | URL resolved (via real browser), content matches |
| Tier C (snippet only) | `false` | URL not actually fetched at content level |
| Any tier failure with no fallback | `false` | URL unverifiable |
| Tier B unavailable (Playwright not installed) | `false` + tag `tier-b-unavailable` | Operator must rerun verification later |

The `paywalled-source` tag distinguishes "intentionally fell back to snippet" from "verification failed entirely."

### Cost notes

Tier A is ~free (curl). Tier B costs ~1-3s per Playwright call plus MCP server overhead. Tier C costs nothing extra. Real-world distribution from operator experience: ~85% Tier A success, ~10% Tier B escalation, ~3% Tier C, ~2% unverifiable. Per-cycle Playwright overhead is bounded.

### Failure-pattern signatures, written form for the runbook

```
Tier A failure signatures (escalate to Tier B):
- HTTP status 401 or 403 with body length > 0
- HTTP 200 with body containing any of:
    "Please enable JavaScript"
    "<title>Just a moment...</title>"
    "data-cf-beacon"
    "_Incapsula_Resource"
    "dd_async_token"
    "Access denied — DataDome"
- HTTP 200 with body length < 500 bytes (likely challenge page, not article)

Tier B failure signatures (escalate to Tier C):
- Rendered body does not contain any keyword from the search snippet
- Body contains paywall markers:
    "Subscribe to read"
    "Sign in to continue"
    "This article is for subscribers"
- Playwright MCP server returns timeout or error
```

---

## §2 — Source list restructure (extends pipeline.md §1 Scrape)

### Current state and failure mode

Original §1 lists ~9 illustrative outlets. In practice the agent searches dozens, but without a catalog and rotation rule, different sessions cover different surfaces, leaving systematic gaps. The CDC quarantine clarification surfaced on Politico (Group 4 below) within hours; the original list didn't include any federal-policy specialists, so the agent didn't search them.

### Proposed groupings (illustrative; agent picks 2-3 per fired group per cycle)

1. **Primary outbreak surveillance (Credibility Tier 1):** WHO DON + WHO daily press briefings + WHO YouTube/X feeds, CDC (HAN + RSS + media releases + press briefings + press conferences), ECDC, Africa CDC, plus national health authorities — UKHSA, RIVM, RKI (incl. Kontaktpersonen guidance pages), Swiss FOPH, Spanish Sanidad / Moncloa press-conference page, Singapore CDA, PHAC, Sante Publique France
2. **Wire services (Cred Tier 1-2):** AP News, AFP, UPI, DPA, EFE, Kyodo, Reuters
3. **US national news (Cred Tier 2-3):** WaPo, NYT, NBC, ABC, CBS, CNN, NPR, USA Today *(NPR placement raised — public-radio fact-checking comparable to BBC)*
4. **US federal-policy specialists (Cred Tier 2):** Politico, Axios, The Hill *(separate subgroup, every-cycle priority — this is where the CDC verbal clarification surfaced first)*
5. **UK national (Cred Tier 2-3):** BBC, Guardian, Sky News, ITV, Telegraph *(broadsheet — moved here from earlier tabloid grouping)*, Independent
6. **EU regional (Cred Tier 2-3):** El País, El Mundo, NL Times, DutchNews, RTÉ, Irish Times, ANSA, Le Monde, France24, Euronews, Der Spiegel
7. **Latin America (Cred Tier 2-3, critical for outbreak-source tracing):** Clarín, La Nación, Mercurio, Folha de São Paulo, Infobae
8. **Asia / Oceania / Africa (Cred Tier 2-3):** SCMP, Mothership, Straits Times, RNZ, 1News, News24, IOL, Türkiye Today
9. **Scientific / public health (Cred Tier 1-2):** virological.org, CIDRAP, STAT News, ProMED, Nature News, Science Magazine, The Lancet, NEJM, JAMA, medRxiv, bioRxiv
10. **Tabloid / popular press (Cred Tier 3-4, requires corroboration search):** NY Post, Daily Mail, The Sun, Mirror, Daily Beast
11. **Aggregators / firehose:** Google News (via WebSearch), Bing News
12. **Social media (Cred Tier 4, signal-only — never sole source for sig-3+):** X/Twitter, Reddit, BlueSky
13. **Reference (Cred Tier 4, early-signal only — never confirmation):** Wikipedia
14. **Prediction markets (context layer):** Polymarket gamma-api, Kalshi

### Cadence rule

- **Every cycle:** groups 1-2 (primary surveillance + wires), **plus group 4 (US federal-policy specialists)**.
- **At least once per 4 cycles:** groups 3, 5-9 (US national + UK + EU + LatAm + Asia/Oceania/Africa + scientific). Pool covered by rotation, not exhaustive per-cycle sweep.
- **On surge or when story-type makes it relevant:** groups 10-11.
- **Always available:** groups 12-13 for early signal. Sampled when other groups produce nothing new.

Group 4 is elevated because the CDC quarantine clarification's surfacing channel was federal-policy specialists — putting it in the rotation pool means cycles where federal-policy nuance gets no coverage.

Named outlets within a group are illustrative — the agent picks 2-3 per fired group per cycle. Goal is breadth-over-time, not exhaustive depth-per-cycle.

### Rotation mechanism

The agent queries `scrape_log` at cycle start to determine which groups in the rotation pool have the oldest most-recent entry, and selects those for this cycle. The agent does not maintain rotation state in conversation context or across sessions — `scrape_log` is the source of truth.

**Implementation note:** `scrape_log.source_type` currently records per-outlet values ("reuters", "ap", etc.). The amendment extends the value space to also accept group identifiers (`"group:eu-regional"`, `"group:scientific"`, etc.). Per-cycle, agent writes both per-outlet rows and a per-group rollup row. Rotation queries filter on `source_type LIKE 'group:%'`.

This is the second of the two amendment-introduced schema items (alongside `events.agent_notes`).

### Corroboration search vs opposing search (distinct mechanisms)

Different tools, different inputs, different outputs. Both can fire on the same event when applicable.

| | **Corroboration search** | **Opposing search (Rule B)** |
|---|---|---|
| **Trigger** | Unverified claim surfacing only on Cred Tier 3-4 outlet | Binary policy claim, any source tier |
| **Question** | Does any Cred Tier 1-2 source confirm this? | Is the framing contested? |
| **If yes** | Promote significance, update tags, drop `requires-corroboration` | Side-by-side both quotes, tag `policy-ambiguity`, agent doesn't pick a side |
| **If no** | Hold at sig-2 with `requires-corroboration` tag; agent doesn't promote | Single-framing event proceeds normally |

Tabloid (group 10) stories run **corroboration search**, not Rule B. Rule B's opposing search is unchanged from the original spec — covers binary policy framings regardless of source tier.

---

## §3 — Rule B update + Rule D (extends pipeline.md write-time rigor section)

### Rule B update: add `binary-policy` tag at write time

When Rule B's opposing-search procedure fires (i.e., the agent identified a binary policy claim and ran the opposing search), the event gets the `binary-policy` tag at original write time, regardless of whether the search returned substantive results.

`policy-ambiguity` remains the separate signal for "framings competed at write time and both quotes shown side-by-side." An event can carry just `binary-policy` (was binary, search returned nothing contradicting), or both `binary-policy` and `policy-ambiguity` (was binary, contradiction surfaced at write time).

This tag drives Rule D's trigger mechanism — without it, Rule D would have to re-parse summary text on every cycle, which is expensive and inconsistent across agents.

### Rule D — follow-up agency-channel checks

For any event tagged `binary-policy` with an agency-name tag (cdc, who, ecdc, ukhsa, rivm, rki, sanidad, etc.), the agent on every subsequent cycle within the re-check window performs follow-up channel checks against that agency.

#### Re-check window

Starts at original event's `created_at`, runs 7 days. Each Rule D clarification UPDATE on this event extends the window 7 days from the clarification's `created_at`. Window queryable from `events.created_at` and `clarifies:<uuid>` tag chains.

Window self-extends as long as the story keeps producing clarifications, naturally closes when the agency stops publishing on the topic. 7-day base bounded so events whose framing is stable don't burn cycles indefinitely.

#### Preflight (cost control)

Before deep channel-check on an in-window event, agent queries `scrape_log` for entries with the matching agency `source_type` since the last Rule D check on this event (or since original event creation if never Rule-D-checked). If nothing new from that agency, skip the deep check this cycle.

This collapses Rule D's per-cycle cost from ~5 channels × ~10 in-window events = ~50 fetches to bounded "preflight read of scrape_log + only deep-check events with new agency activity."

#### Channels checked when preflight indicates new agency activity

- Press releases / official statements page
- Periodic press-briefing transcripts
- Press-conference video/audio coverage by Tier 1-2 outlets within 48h
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

1. Insert a clarification event with tags `['policy-clarification', 'clarifies:<original-uuid>', <agency>, ...]`.
2. Issue an UPDATE to the original event reframing it to match the agency's most recent statement — softening, strengthening, or rephrasing as warranted.
3. (Original event already carries `binary-policy`; clarification event does not need it unless the clarification is also a binary policy claim.)

#### Linking convention

No `related_event_id` schema column. Clarification chains live in tags:

- Clarification event tags include `clarifies:<uuid-of-original>`.
- Reverse lookup: `SELECT * FROM events WHERE 'clarifies:' || $1 = ANY(tags)`.
- Operator can grep `clarifies:` in feed view to spot chains.

### New tag definitions

| Tag | Meaning |
|---|---|
| `binary-policy` | Event's claim is binary policy (mandatory/voluntary etc.); Rule D will re-check |
| `policy-ambiguity` | At original write time, two contradictory framings existed across Tier 1-2 sources. Both shown. |
| `policy-clarification` | This event clarifies/contradicts an earlier event from the same agency. Linked via `clarifies:<uuid>`. |
| `clarifies:<uuid>` | Linkage tag pointing from clarification event to original |
| `paywalled-source` | Event sourced from search snippet because Tier C verification (paywall) blocked full fetch |
| `tier-b-unavailable` | Tier B verification failed because Playwright MCP server was unavailable; needs operator rerun |
| `requires-corroboration` | Tier 3-4 source only; corroboration search returned nothing. Held at sig-2. |

---

## §4 — agent_notes mechanism (new content in pipeline.md write-time rigor section)

### Why a column instead of inline summary content

An earlier draft proposed appending `[NOTES: ...]` blocks to `events.summary`. Rejected: `events.summary` is the public-facing field rendered by EventCard, the map drawer, and the OG image generator. Appending agent reasoning to a public field requires either a frontend strip (which violates the original spec's no-UI-change non-goal) or accepting public-facing leak of internal notes.

Honest answer: a separate column.

### Mechanism

New column on `events` table:

```sql
ALTER TABLE events
  ADD COLUMN agent_notes TEXT;

COMMENT ON COLUMN events.agent_notes IS
  'Agent-authored reasoning trace for sig-4+ events with binary-policy, '
  'policy-ambiguity, paraphrased, or policy-clarification tags. '
  'Internal-only; never surfaced to public UI.';
```

Nullable. Pre-amendment events stay NULL. Public dashboard surfaces don't project the column. Operator reads via `supabase db query --linked` or a future internal admin view.

### Defensive frontend audit

Public-facing surfaces that read events must explicitly project columns rather than `SELECT *`. The implementation plan includes a frontend-side audit task: every event-fetch query in `app/`, `components/`, and `lib/` is converted from `SELECT *` (or implicit `*` via Supabase client builder) to explicit column lists that exclude `agent_notes`. Without this, the column leaks via existing client-side fetches.

### Trigger condition (narrow)

The agent populates `agent_notes` for events carrying any of these tags:

- `binary-policy`
- `policy-ambiguity`
- `paraphrased`
- `policy-clarification`

Routine descriptive primary-source events (most WHO DONs, CDC HAN updates) do not get notes — the source said it, the agent quoted it, end of story. Notes overhead on every sig-4+ event would be expensive and redundant.

### What the notes contain

One paragraph of structured prose covering:

- What searches the agent ran (Rule B opposing-search results, corroboration searches if applicable)
- What tier of sources surfaced what
- Why the agent picked this framing
- What follow-up Rule D will perform (if applicable)

### Examples

**Example 1 — `policy-clarification` event (Rule D fire):**

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
  within 4h. Tier 1-2 corroboration satisfied; original event UPDATEd,
  this clarification inserted.
```

**Example 2 — `binary-policy` event with no Rule B contradiction at write time:**

```
events.summary:
  Spanish Health Minister at press conference (May 8): 'Mandatory
  monitoring will be implemented for all returnees from the affected
  region for 14 days'.

events.tags:
  ['binary-policy', 'sanidad', 'primary-source', 'mv-hondius']

events.agent_notes:
  Rule B opposing-search ran "voluntary monitoring Spain MV Hondius" -
  no Tier 1-2 contradicting framing surfaced. Single primary-source
  framing held. Event tagged binary-policy so Rule D will re-check
  Sanidad's channels for 7 days from now. No policy-ambiguity tag
  (no contradiction at write time).
```

The second example demonstrates the common case: Rule B fires (binary policy claim), opposing-search returns nothing, event proceeds normally with `binary-policy` tag (which arms Rule D). This is the failure mode the original CDC case missed entirely.

---

## §5 — Implementation sequence

### Dependency graph

```
[Migration] events.agent_notes column          ──┐
[Migration] scrape_log.source_type group ids   ──┼─→ [Tasks 1-2]
                                                  │
[Operator setup] Playwright MCP server         ──┴─→ [Task 3]
                                                  │
[Runbook patch] pipeline.md §4.5 verification   ──┐
  - Tier A/B/C terminology                       ─┼─→ [Tasks 4-5]
  - Three-tier mechanism + signatures           ─┘
                                                  │
[Runbook patch] pipeline.md §1 Scrape           ──┐
  - source-list restructure                      ─┤
  - cadence rule + every-cycle group 4          ─┼─→ [Tasks 6-8]
  - rotation mechanism via scrape_log           ─┘   (depend on group identifiers)
                                                  │
[Runbook patch] pipeline.md write-time-rigor    ──┐
  - Rule B: binary-policy tag at write time     ─┤
  - Rule D: full mechanism                       ─┼─→ [Tasks 9-12]
  - clarifies:<uuid> + tag definitions          ─┤
  - agent_notes mechanism                        ─┘   (depend on agent_notes column)
                                                  │
[Frontend] Defensive column projection          ────→ [Task 13]
  audit (excludes agent_notes)
                                                  │
[Spec hygiene] Cross-link updates              ────→ [Task 14]
[Operator runbook] Playwright MCP precondition ────→ [Task 15]
                                                  │
[Verification] migrations + smoke test          ────→ [Tasks 16-17]
```

### Task table (for writing-plans)

Every task is prefixed with the file being patched to remove the section-naming collision.

| # | Task | Files |
|---|---|---|
| 1 | Migration: add `events.agent_notes TEXT NULL` column with COMMENT | Create: `supabase/migrations/<ts>_events_agent_notes.sql` |
| 2 | Migration: extend `scrape_log.source_type` value space + add group identifier convention to runbook | Create: `supabase/migrations/<ts>_scrape_log_source_groups.sql`. Modify: `docs/runbooks/pipeline.md` (source-type list section) |
| 3 | Operator-environment setup: install + authenticate Playwright MCP server in pipeline operator session profile; document precondition | Modify: `docs/runbooks/pipeline-operator.md` (pre-cycle checklist) |
| 4 | Patch `pipeline.md` §4.5 (URL verification): rename any existing numeric "access tier" references to letter form (Tier A/B/C) | Modify: `docs/runbooks/pipeline.md` |
| 5 | Patch `pipeline.md` §4.5 (URL verification): replace WebFetch-only verification with three-tier access mechanism (curl → Playwright → snippet), including failure-pattern signatures and `is_verified` semantics table from amendment §1 | Modify: `docs/runbooks/pipeline.md` |
| 6 | Patch `pipeline.md` §1 (Scrape): source-list restructure — 13 groups, NPR/Telegraph re-placement, federal-policy subgroup as group 4, replace existing illustrative outlet list | Modify: `docs/runbooks/pipeline.md` |
| 7 | Patch `pipeline.md` §1 (Scrape): cadence rule (every-cycle: groups 1-2-4; rotation pool: groups 3, 5-9 ≥1/4 cycles; surge: 10-11; always-available: 12-13) | Modify: `docs/runbooks/pipeline.md` |
| 8 | Patch `pipeline.md` §1 (Scrape): rotation mechanism via `scrape_log` recency query + corroboration-search vs opposing-search distinction table | Modify: `docs/runbooks/pipeline.md` |
| 9 | Patch `pipeline.md` write-time-rigor §B (Rule B): add `binary-policy` tag at write time when opposing-search fires, regardless of contradiction surfacing | Modify: `docs/runbooks/pipeline.md` |
| 10 | Patch `pipeline.md` write-time-rigor: add §D (Rule D) full mechanism — trigger condition, re-check window, scrape_log preflight, channels checked, action list (insert clarification + UPDATE original) | Modify: `docs/runbooks/pipeline.md` |
| 11 | Patch `pipeline.md` write-time-rigor: add tag definition table (binary-policy, policy-ambiguity, policy-clarification, clarifies:<uuid>, paywalled-source, tier-b-unavailable, requires-corroboration) | Modify: `docs/runbooks/pipeline.md` |
| 12 | Patch `pipeline.md` write-time-rigor: add §E (agent_notes mechanism) — trigger condition, content structure, both worked examples | Modify: `docs/runbooks/pipeline.md` |
| 13 | Defensive frontend audit: convert `SELECT *` (and implicit `*` via Supabase builder) to explicit column projection across all event-fetch sites in `app/`, `components/`, `lib/`. Exclude `agent_notes` from public projections. | Modify: every file matching `rg "from\('events'\)" -l` plus any direct `events` table SQL in `lib/` |
| 14 | Cross-link updates: add inline cross-links in `pipeline.md` §3 (Process & score) referencing Rule D for binary-policy claims; in §5 (Write) referencing agent_notes for trigger-tagged events | Modify: `docs/runbooks/pipeline.md` |
| 15 | Patch `pipeline-operator.md` (operator runbook): pre-cycle checklist updated with Playwright MCP precondition; tag `tier-b-unavailable` documented as "needs operator rerun later" | Modify: `docs/runbooks/pipeline-operator.md` |
| 16 | Apply both migrations to remote prod via `supabase db push --linked`; verify `events.agent_notes` and `scrape_log.source_type` group-id values via `supabase db query --linked` | (no file changes) |
| 17 | Smoke verification cycle: run a manual pipeline cycle against the patched runbook, spot-check that next 5 sig-4+ events follow rules A/A.2/B (with `binary-policy` tag), populate `agent_notes` correctly per trigger-tag rules, AND that at least one Tier B and one Tier C escalation fires correctly within first 24 cycles | (no file changes) |

17 tasks total. Tasks 1-3 (migrations + operator setup) and Task 13 (frontend audit) are the only code-touching / environment tasks; everything else is markdown additions or remote-DB application.

### Acceptance criteria

In addition to the original 2026-05-09 spec's acceptance criteria:

- `events.agent_notes` column exists in remote prod, NULL on all pre-amendment events.
- `scrape_log.source_type` accepts and indexes `group:*` value forms.
- `pipeline-operator.md` pre-cycle checklist includes Playwright MCP server precondition; operator following the runbook from a fresh session has Tier B available.
- Spot-check of the next 5 sig-4+ events:
  - Events with binary policy claims carry `binary-policy` tag at original write time.
  - `agent_notes` populated for any event carrying any of the four trigger tags.
  - `agent_notes` NULL for routine descriptive sig-4+ events.
- Spot-check of source-list groupings: agent's actual cycle hits show every-cycle pool covered every cycle, 4-cycle rotation pool fully covered within rolling 4-cycle window per `scrape_log` recency.
- Spot-check of clarification chains: `clarifies:<uuid>` tag points to a real `events.id` UUID; reverse lookup query returns the chain correctly.
- **Verification-mechanism functional test:** within first 24 cycles after amendment lands, at least one Tier B escalation and one Tier C escalation fire correctly, with appropriate `is_verified` and tag values logged.
- Defensive frontend audit complete: no public-facing event query returns `agent_notes` to the client.

### Honest residual drift, framed for the amendment's scope

The amendment makes the system more enforceable, not foolproof. Four residual drift modes the amendment does not solve:

1. **Source the amendment doesn't surface.** If a clarification surfaces only on a Cred Tier 4 outlet (say, a regional newspaper not in any of the 13 groups), Rule D's preflight finds no agency activity and skips. The amendment biases toward Cred Tier 1-2 surfaces because that's where agency clarifications historically surface — but a hypothetical clarification surfacing exclusively on a state-level press conference covered only by local media would slip past.

2. **Window expiration mid-story.** Rule D's window self-extends per clarification. If the agency goes silent for 7+ days and then publishes a final clarification on day 10, the window has closed and Rule D won't fire. Operator catches it manually; no rule prevents this.

3. **Verbal clarifications never transcribed.** If an agency official says something to a reporter not on background, and no Tier 1-2 outlet quotes them within the 7-day window, the amendment can't see it. Same as today — but the amendment makes this the residual, not the dominant, failure mode.

4. **Agent interpretation of preflight check.** Rule D's preflight ("any new agency activity since last check on this event") asks the agent to judge whether activity is *relevant* to this event's topic. Different agents interpret this differently — e.g., is a WHO DON on a different outbreak "new activity" for a CDC quarantine event? The amendment doesn't pin a relevance heuristic; agents will interpret variably until operator feedback shapes the convention.

These are the modes worth naming honestly so future sessions know what the amendment buys and what it doesn't.

---

## Decisions log (extends original spec's)

| Decision | Choice | Why |
|---|---|---|
| Verification mechanism | Three tiers: A (curl) / B (Playwright MCP) / C (snippet) | WebFetch-alone silently excludes Reuters-class outlets behind bot protection |
| Naming for verification tiers | Letters (Tier A/B/C) | Numeric collides with existing `## Source credibility tiers` (Tier 1-4 by source quality) |
| Source list breadth | 13 groups, ~50 illustrative outlets, named cadence | Original 9 outlets too sparse; CDC quarantine miss surfaced in Group 4 (federal-policy specialists) |
| Group 4 cadence | Every cycle (alongside groups 1-2) | Where the CDC clarification surfaced first; rotation-pool inclusion would miss this |
| Rotation mechanism | scrape_log recency query, no in-context state | Session-independent, deterministic, uses existing infrastructure |
| Schema migration line | Partially relaxed | Rule D's clarification chains and agent_notes trace not enforceable as pure markdown additions |
| agent_notes storage | Schema column (`events.agent_notes TEXT NULL`) | Inline `[NOTES: ...]` in summary leaks to public UI; alternative scrape_log.error is per-cycle not per-event |
| Linking clarifications to originals | Tag chain (`clarifies:<uuid>`) | Schema-column alternative (`related_event_id`) was a larger migration; tag-chain works with existing TEXT[] |
| Rule D trigger tag | `binary-policy` set at write time when Rule B fires | Re-parsing summary text on every cycle is expensive and inconsistent across agents |
| Rule D window anchor | Original event `created_at` + 7d, self-extending per clarification | "Most recent agency activity on topic" is hard to compute; this is directly available from existing data |
| Rule D cost control | scrape_log preflight check | Deep channel-checks on every in-window event would dominate cycle time |
| Tier C usage | Snippet-only with `paywalled-source` tag, `is_verified=false` | More honest than excluding the source; tag flags operator review |
| Tier B unavailable | Tag `tier-b-unavailable` + `is_verified=false` | Silent fallback to Tier C would mis-classify operator-fixable failures as paywall failures |
| Rule UPDATE direction | Symmetric (softening, strengthening, or rephrasing) | Original "softening only" was leftover from CDC case; agencies sometimes strengthen language too |

---

## Implementation framing for writing-plans

This is a moderately-sized patch: 17 tasks, two migrations, two operator-environment items (Playwright MCP setup, runbook precondition), one frontend audit, and ~12 markdown patches to `pipeline.md` plus 1 to `pipeline-operator.md`.

Scope at a glance:

- **Files modified:** `docs/runbooks/pipeline.md`, `docs/runbooks/pipeline-operator.md`, `lib/queries.ts` (or wherever events are fetched — audit determines exact set), various component files
- **Files created:** 2 migration files in `supabase/migrations/`
- **Schema changes:** 1 nullable column on `events`, 1 value-space extension on `scrape_log.source_type`
- **Environment changes:** Playwright MCP server installed in pipeline operator profile
- **No frontend functional UI change** — the frontend audit is defensive (column projection), not a UX change
- **No tests added** — per original spec's pattern, verification is operator-on-sight + smoke cycle

When picking this up: invoke `superpowers:writing-plans` to convert this spec into a task-by-task plan. Each row in §5's task table maps to one or two Edit/Bash steps in the writing-plans output.
