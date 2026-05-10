# Write-time rigor amendment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the write-time rigor amendment specced in `docs/superpowers/specs/2026-05-10-write-time-rigor-amendment.md` — three-tier URL verification (curl → Playwright → snippet), restructured source list with cadence rule, Rule D follow-up agency-channel checks, agent_notes column for sig-4+ trigger-tagged events.

**Architecture:** Mostly markdown additions to two runbook files (`docs/runbooks/pipeline.md`, `docs/runbooks/pipeline-operator.md`). One nullable schema column (`events.agent_notes`). One conditional migration (only if `scrape_log.source_type` has a CHECK constraint — verified up front; current state has no CHECK so the migration is skipped). One defensive frontend audit converting `SELECT *` event-fetch sites to explicit column projection that excludes `agent_notes`.

**Tech Stack:** Markdown runbook (no formal lint), Supabase Postgres + `supabase db query --linked` for production verification, Next.js 14 App Router with `@/lib/supabase-server`, Playwright MCP server (operator environment).

---

## File structure

| File | Created or modified | Purpose |
|---|---|---|
| `supabase/migrations/20260510000000_events_agent_notes.sql` | **Create** | Add nullable `agent_notes TEXT` column on `events` |
| `docs/runbooks/pipeline.md` | **Modify** | All §1 / §3 / §4.5 / §5 / write-time-rigor patches |
| `docs/runbooks/pipeline-operator.md` | **Modify** | Playwright MCP precondition row + `tier-b-unavailable` tag note |
| `lib/types.ts` | **Modify** | Add optional `agent_notes` field to `Event` interface — typed as `null` so projections that exclude it stay sound |
| `app/page.tsx` | **Modify** | Replace `events.select('*')` with explicit column projection excluding `agent_notes` |
| `app/event/[id]/page.tsx` | **Modify** | Same defensive projection |
| `app/event/[id]/opengraph-image.tsx` | **Modify** | Same defensive projection |
| `app/case/[case_code]/page.tsx` | **Modify** | Same defensive projection |

---

## Pre-flight (run once before starting Task 1)

- [ ] **Confirm working directory and clean tree**

```bash
pwd
git status
```

Expected: `/Users/claude/Projects/project_contagion`, working tree clean (or only the plan/spec files staged, not pushed yet).

- [ ] **Confirm linked Supabase CLI**

```bash
supabase db query "SELECT current_database();" --linked
```

Expected: returns the linked project's database name.

- [ ] **Confirm `events.agent_notes` does NOT yet exist**

```bash
supabase db query "SELECT column_name FROM information_schema.columns WHERE table_name='events' AND column_name='agent_notes';" --linked
```

Expected: empty result. If a row returns, the migration has already been applied — skip Task 1's migration creation but still verify the runbook patches reference the column.

- [ ] **Confirm `scrape_log.source_type` has no CHECK constraint** (drives Task 2)

```bash
supabase db query "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='scrape_log'::regclass AND contype='c';" --linked
```

Expected: empty result. (The initial schema declares `scrape_log.source_type TEXT NOT NULL` with no CHECK, so this confirms Task 2 has nothing to do.)

If a CHECK constraint **does** appear, treat the conditional Task 2 path described later (`Task 2 — conditional migration path`) as live; otherwise Task 2 is a verification-only no-op.

---

## Task 1: Create migration for `events.agent_notes` column

**Files:**
- Create: `supabase/migrations/20260510000000_events_agent_notes.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260510000000_events_agent_notes.sql` with this exact content:

```sql
-- Write-time rigor amendment: agent reasoning trace
-- Spec: docs/superpowers/specs/2026-05-10-write-time-rigor-amendment.md §4
--
-- Internal-only column — never projected to public dashboard surfaces.
-- Populated by the pipeline agent for sig-4+ events carrying any of:
--   binary-policy | policy-ambiguity | paraphrased | policy-clarification
-- Routine descriptive sig-4+ events leave this NULL.

ALTER TABLE events
  ADD COLUMN agent_notes TEXT;

COMMENT ON COLUMN events.agent_notes IS
  'Agent-authored reasoning trace for sig-4+ events with binary-policy, '
  'policy-ambiguity, paraphrased, or policy-clarification tags. '
  'Internal-only; never surfaced to public UI.';
```

- [ ] **Step 2: Validate locally if Colima is up; otherwise skip to remote application in Task 15**

```bash
supabase db reset --no-seed 2>&1 | tail -20
```

Expected outcomes:
- If Colima is running and Supabase local is healthy: migration applies cleanly, `agent_notes` column appears on local `events` table.
- If `Cannot connect to the Docker daemon` or similar: skip — `npm run db:reset` is optional locally; Task 15 applies the migration to remote prod.

If local validation succeeded, confirm the column:

```bash
supabase db query "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='events' AND column_name='agent_notes';"
```

Expected: `agent_notes | text | YES` (nullable).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260510000000_events_agent_notes.sql
git commit -m "$(cat <<'EOF'
Add events.agent_notes column for write-time rigor amendment

Nullable TEXT column populated by pipeline agent for sig-4+ events
carrying binary-policy / policy-ambiguity / paraphrased /
policy-clarification tags. Internal-only — public UI projects
explicit columns and excludes this one (Task 13).

Spec: docs/superpowers/specs/2026-05-10-write-time-rigor-amendment.md §4

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Verify `scrape_log.source_type` constraint state (conditional migration)

**Files:**
- Create (only if CHECK constraint exists): `supabase/migrations/20260510000001_scrape_log_source_groups.sql`

- [ ] **Step 1: Confirm verification result from pre-flight**

The pre-flight query already established whether a CHECK constraint exists. Re-confirm:

```bash
supabase db query "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='scrape_log'::regclass AND contype='c';" --linked
```

If the result is **empty** → no migration needed. The `group:*` value-space convention is runbook-only and lands in Task 8. **Skip Step 2 and Step 3 of this task.**

If the result contains a CHECK constraint enumerating allowed `source_type` values → proceed to Step 2.

- [ ] **Step 2: (Conditional) Write the migration to extend the CHECK constraint**

Only run this step if Step 1 found a CHECK constraint. Create `supabase/migrations/20260510000001_scrape_log_source_groups.sql`:

```sql
-- Write-time rigor amendment: scrape_log group rollup support
-- Spec: docs/superpowers/specs/2026-05-10-write-time-rigor-amendment.md §2
--
-- Pipeline agent writes per-group rollup rows (e.g., 'group:eu-regional')
-- alongside per-outlet rows. Rotation queries filter on source_type LIKE 'group:%'.
-- This migration only fires if a CHECK constraint was enumerating allowed
-- source_type values (i.e., the constraint would have rejected 'group:*' writes).

ALTER TABLE scrape_log
  DROP CONSTRAINT IF EXISTS scrape_log_source_type_check;

-- Replace with permissive constraint that accepts any non-empty TEXT
ALTER TABLE scrape_log
  ADD CONSTRAINT scrape_log_source_type_check
  CHECK (source_type <> '');
```

If the original constraint name was different than `scrape_log_source_type_check`, replace both `DROP CONSTRAINT IF EXISTS <name>` and the `ADD CONSTRAINT <name>` with the actual constraint name returned by the Step 1 query.

- [ ] **Step 3: (Conditional) Commit**

```bash
git add supabase/migrations/20260510000001_scrape_log_source_groups.sql
git commit -m "$(cat <<'EOF'
Allow group:* values in scrape_log.source_type

Pipeline agent writes per-group rollup rows for the rotation
mechanism in pipeline.md §1. Replaces the enumerated CHECK
with a non-empty TEXT constraint.

Spec: docs/superpowers/specs/2026-05-10-write-time-rigor-amendment.md §2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If Step 1 found no CHECK constraint, this task produces no commit and no file change. Move to Task 3a.

---

## Task 3a: Operator-environment setup — Playwright MCP server

**Files:** none committed to repo (operator environment only).

This task is performed by the human operator in their own environment, not by an agent in the repo. It's listed here for completeness of the prerequisites; the implementer agent records progress but does not perform the install itself.

- [ ] **Step 1: Operator confirms Playwright MCP server is installed**

The operator runs (in their own shell, not via agent):

```bash
claude mcp list | grep -i playwright
```

Expected: a row showing the Playwright MCP server installed and authenticated. If absent, the operator follows the Playwright MCP plugin install path (`claude mcp add` per the plugin documentation) before continuing.

- [ ] **Step 2: Agent records confirmation in plan checkbox**

The implementing agent does not perform the install. It only verifies the operator has confirmed by checking that subsequent tasks reference the precondition correctly. Mark Step 1 complete only when the operator confirms via the runbook (Task 17 closes this loop).

No commit produced from this task. Proceed to Task 3b.

---

## Task 3b: Patch `pipeline-operator.md` with Playwright MCP precondition

**Files:**
- Modify: `docs/runbooks/pipeline-operator.md`

- [ ] **Step 1: Read current Prerequisites section**

```bash
sed -n '40,55p' docs/runbooks/pipeline-operator.md
```

Expected: a markdown table titled "Prerequisites (one-time setup, already done if you're reading this)" with rows for Claude session, Supabase CLI, Chrome with persistent profile, and Vercel env vars.

- [ ] **Step 2: Add Playwright MCP row to the Prerequisites table**

Use the Edit tool to replace the table. Old text (verbatim):

```
| Thing | Where it lives | Why |
|---|---|---|
| Claude session | Claude Code, Cowork, or any client with Supabase CLI | Where the pipeline runs |
| `supabase` CLI authenticated | `supabase link` already run against the linked project | All writes go via `supabase db query --linked`; no service-role key needed |
| Chrome with persistent profile (optional) | Logged into X/Twitter, BlueSky, Reddit | Lets the agent scrape without auth dialogs (only needed if Chrome MCP is in use) |
| Vercel `NEXT_PUBLIC_*` env vars | Already in Vercel project settings | Production already pulls these on deploy |
```

Replace with:

```
| Thing | Where it lives | Why |
|---|---|---|
| Claude session | Claude Code, Cowork, or any client with Supabase CLI | Where the pipeline runs |
| `supabase` CLI authenticated | `supabase link` already run against the linked project | All writes go via `supabase db query --linked`; no service-role key needed |
| Chrome with persistent profile (optional) | Logged into X/Twitter, BlueSky, Reddit | Lets the agent scrape without auth dialogs (only needed if Chrome MCP is in use) |
| **Playwright MCP server (required)** | `claude mcp list \| grep playwright` returns a row | Tier B URL verification — needed for Reuters/Bloomberg/WaPo/FT class outlets behind DataDome / similar bot protection. If absent, agent records `is_verified=false` with tag `tier-b-unavailable` and operator must rerun. See pipeline.md §4.5. |
| Vercel `NEXT_PUBLIC_*` env vars | Already in Vercel project settings | Production already pulls these on deploy |
```

(Note: in the actual file, escape the pipe inside backticks as `\|` to keep markdown table parsing intact.)

- [ ] **Step 3: Verify the edit applied**

```bash
grep -n "Playwright MCP server" docs/runbooks/pipeline-operator.md
```

Expected: at least one match in the Prerequisites table.

- [ ] **Step 4: Commit**

```bash
git add docs/runbooks/pipeline-operator.md
git commit -m "$(cat <<'EOF'
Add Playwright MCP precondition to operator runbook

Tier B URL verification (curl→Playwright fallback) requires the
MCP server installed and authenticated in the operator's session
profile. Documents the tier-b-unavailable tag for operator rerun
when the precondition is missed.

Spec: docs/superpowers/specs/2026-05-10-write-time-rigor-amendment.md §1

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Patch pipeline.md §4.5 — rename numeric access tiers to letters

**Files:**
- Modify: `docs/runbooks/pipeline.md`

- [ ] **Step 1: Search for any existing numeric "access tier" references that would collide**

```bash
grep -n -i "access tier\|tier 1\|tier 2\|tier 3" docs/runbooks/pipeline.md
```

Existing matches in the runbook are credibility-tier references (Tier 1 / Tier 2 / etc. by source quality) under `## Source credibility tiers`. Those stay numeric. The amendment introduces letter access-tiers (A / B / C) and the word "access tier" should not appear in numeric form anywhere.

If the search returns lines like `"Tier 1 source"` or `"Tier-1 source"` referring to credibility — leave them alone. If any existing line says `"access tier 1"` or similar — flag it for the implementer to rename in this step. Current state (verified at plan-write time) has no such collision; this step is defensive.

- [ ] **Step 2: No edit needed — confirm Step 1 produced only credibility-tier matches**

If Step 1 returned only credibility-tier lines (under `## Source credibility tiers`, fact-check section, etc.), this task is complete with no edit. Mark complete and proceed to Task 5.

- [ ] **Step 3: (Conditional) If any pre-existing numeric "access tier" found, rename in place**

Only execute if Step 1 surfaced a real collision. Use Edit to rename `access tier 1/2/3` to `Tier A/B/C` for the access-mechanism uses, leaving credibility-tier numeric references untouched. Then commit:

```bash
git add docs/runbooks/pipeline.md
git commit -m "$(cat <<'EOF'
Reserve numeric Tier 1-4 for credibility, letters for access mechanism

Pre-amendment runbook had no access-tier collision. This commit is
recorded only if Task 4 Step 1 found one needing rename.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If Step 1 produced no matches, this task ends at Step 2 with no commit.

---

## Task 5: Replace pipeline.md §4.5 mechanism with three-tier verification

**Files:**
- Modify: `docs/runbooks/pipeline.md` (lines 100-112, the §4.5 section)

- [ ] **Step 1: Read current §4.5 to confirm anchor text**

```bash
sed -n '100,113p' docs/runbooks/pipeline.md
```

Expected: the current single-paragraph WebFetch-only verification description plus the `is_verified` semantics line and the dead-link rationale paragraph.

- [ ] **Step 2: Replace §4.5 with the three-tier mechanism**

Use the Edit tool. Old text (verbatim, as it currently exists):

```
### 4.5. URL verification (mandatory before any write)

**Every candidate event must have a `source_url` that actually resolves.** Before INSERT, call WebFetch (or HEAD) on the URL. If the response is non-2xx, the URL is paywalled-redirected to a generic page, or the fetch errors:

- Skip the event entirely. Do **not** invent a different URL.
- Do **not** approximate the URL based on the publication's typical slug format.
- If the search snippet is interesting but no resolvable URL exists, log a `signal`-tagged event with `source_url = NULL` and a note in the summary that the URL was unverified — but only for content that's clearly identifiable from the snippet alone (e.g. an official press release where the agency name is the source).

**`is_verified` semantics:** set `is_verified = true` for events written from a resolved URL (WebFetch returned 2xx and content matches the summary). Set `is_verified = false` for events written from search snippets without a resolvable URL (rare — see exception above). Do not set `is_verified = true` based on tier alone; the field tracks URL existence, not source authority.

The `events.source_url_hash` unique index prevents duplicate URL inserts but does **not** validate that URLs resolve. URL verification is the agent's responsibility.

The reason: past pipeline cycles accumulated dead links — both AI-hallucinated URLs (model guessed a plausible slug that never existed) and real-but-rotted URLs (paywall, deletion, slug change). The dashboard's intelligence feed is only useful if every "SOURCE ↗" link works. Verification at write time prevents the rot.
```

New text:

```
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
```

- [ ] **Step 3: Verify the edit applied**

```bash
grep -n "^### 4.5\|^#### Tier [ABC]\|tier-b-unavailable" docs/runbooks/pipeline.md
```

Expected: matches for the §4.5 header, the three Tier headers, and at least one `tier-b-unavailable` line.

- [ ] **Step 4: Commit**

```bash
git add docs/runbooks/pipeline.md
git commit -m "$(cat <<'EOF'
Replace WebFetch-only URL verification with three-tier mechanism

Tier A (curl) → Tier B (Playwright MCP) → Tier C (snippet-only),
with explicit failure-pattern signatures and is_verified semantics
table. Tier B unavailable produces tier-b-unavailable tag rather
than silent fall-through to Tier C.

Closes the WebFetch-blocked-Reuters-class-outlet failure mode.

Spec: docs/superpowers/specs/2026-05-10-write-time-rigor-amendment.md §1

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Patch pipeline.md §1 Scrape — source-list restructure

**Files:**
- Modify: `docs/runbooks/pipeline.md` (lines 35-51, the §1 Scrape table)

- [ ] **Step 1: Read current §1 Scrape table to confirm anchor**

```bash
sed -n '35,52p' docs/runbooks/pipeline.md
```

Expected: 9-row table with WHO DON / CDC / ECDC / Africa CDC / Google News / Reddit / BlueSky / X/Twitter / Wikipedia.

- [ ] **Step 2: Replace the §1 source list with 13 grouped categories**

Old text (verbatim):

```
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
```

New text:

```
### 1. Scrape

The agent picks 2-3 outlets per fired group per cycle. Cadence (which groups fire each cycle) is documented in §1 cadence below; rotation mechanism in §1 rotation.

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
```

- [ ] **Step 3: Verify the edit**

```bash
grep -c "^[0-9]\+\. \*\*" docs/runbooks/pipeline.md | head -5
grep -n "Primary outbreak surveillance\|Wire services\|US federal-policy specialists\|Tabloid / popular press" docs/runbooks/pipeline.md
```

Expected: ~14 numbered group headings (the 14 groups), and matches for each named heading above.

- [ ] **Step 4: Commit**

```bash
git add docs/runbooks/pipeline.md
git commit -m "$(cat <<'EOF'
Restructure pipeline §1 source list into 13 grouped categories

Replaces 9 illustrative outlets with 13 (+1 prediction-markets)
groups covering ~50 named outlets. NPR placed at Tier 2-3 with
US national; Telegraph as UK broadsheet (group 5, not tabloid);
US federal-policy specialists carved out as group 4.

Spec: docs/superpowers/specs/2026-05-10-write-time-rigor-amendment.md §2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add §1 cadence rule (every-cycle pool + rotation pool + surge)

**Files:**
- Modify: `docs/runbooks/pipeline.md` (insert new subsection after the source groups)

- [ ] **Step 1: Locate insertion point**

After Task 6, the §1 section ends with: `Capture for every event: URL, full text, author/handle, timestamp, engagement counts. Persist raw text in events.raw_content.`

Confirm that line:

```bash
grep -n "Persist raw text in" docs/runbooks/pipeline.md
```

- [ ] **Step 2: Insert the cadence subsection**

Use Edit. Old text:

```
Capture for every event: URL, full text, author/handle, timestamp, engagement counts. Persist raw text in `events.raw_content`.
```

New text:

```
Capture for every event: URL, full text, author/handle, timestamp, engagement counts. Persist raw text in `events.raw_content`.

#### Cadence rule (which groups fire each cycle)

- **Every cycle:** groups 1-2 (primary surveillance + wires), **plus group 4 (US federal-policy specialists)**.
- **At least once per 4 cycles:** groups 3, 5-9 (US national + UK + EU + LatAm + Asia/Oceania/Africa + scientific). Pool covered by rotation, not exhaustive per-cycle sweep.
- **On surge or when story-type makes it relevant:** groups 10-11 (tabloid + aggregators).
- **Always available:** groups 12-13 (social media + reference) for early signal. Sampled when other groups produce nothing new and weak-signal coverage is wanted.

Group 4 is elevated because federal-policy specialists are the channel where agency verbal clarifications surface before wires pick them up; the CDC quarantine-clarification miss was directly traceable to group 4 not being part of the every-cycle pool.
```

- [ ] **Step 3: Verify**

```bash
grep -n "Cadence rule\|At least once per 4 cycles\|Group 4 is elevated" docs/runbooks/pipeline.md
```

Expected: three matches in §1.

- [ ] **Step 4: Commit**

```bash
git add docs/runbooks/pipeline.md
git commit -m "$(cat <<'EOF'
Add cadence rule to pipeline §1

Every-cycle pool: groups 1-2-4. Rotation pool: groups 3, 5-9 with
≥1/4 cycle coverage. Surge: 10-11. Always-available: 12-13.
Group 4 (federal-policy specialists) elevated because that's where
the CDC quarantine clarification surfaced first.

Spec: docs/superpowers/specs/2026-05-10-write-time-rigor-amendment.md §2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add §1 rotation mechanism + corroboration vs opposing-search distinction

**Files:**
- Modify: `docs/runbooks/pipeline.md` (insert two more subsections after the cadence rule)

- [ ] **Step 1: Locate insertion point (end of cadence subsection)**

```bash
grep -n "the CDC quarantine-clarification miss was directly traceable" docs/runbooks/pipeline.md
```

This line is the last in the cadence subsection. Insertion goes immediately after.

- [ ] **Step 2: Insert the rotation mechanism subsection**

Old text (the line that ends the cadence subsection):

```
Group 4 is elevated because federal-policy specialists are the channel where agency verbal clarifications surface before wires pick them up; the CDC quarantine-clarification miss was directly traceable to group 4 not being part of the every-cycle pool.
```

New text:

```
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
```

- [ ] **Step 3: Verify**

```bash
grep -n "Rotation mechanism\|Corroboration search vs opposing\|group:eu-regional\|requires-corroboration" docs/runbooks/pipeline.md
```

Expected: at least four matches.

- [ ] **Step 4: Commit**

```bash
git add docs/runbooks/pipeline.md
git commit -m "$(cat <<'EOF'
Add rotation mechanism + corroboration/opposing-search distinction

Rotation: scrape_log recency query picks two oldest groups per
cycle from the rotation pool. group:* source_type convention is
additive (no CHECK constraint). Corroboration vs opposing-search
table makes the two mechanisms distinct.

Spec: docs/superpowers/specs/2026-05-10-write-time-rigor-amendment.md §2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Patch Rule B in write-time rigor — add `binary-policy` tag at write time

**Files:**
- Modify: `docs/runbooks/pipeline.md` (§B subsection of write-time rigor, currently lines 188-198)

- [ ] **Step 1: Read current §B**

```bash
sed -n '188,200p' docs/runbooks/pipeline.md
```

Expected: the existing §B description with the three numbered actions.

- [ ] **Step 2: Patch §B to add binary-policy tag**

Old text (verbatim):

```
### B. Opposing-search (binary policy claims)

For any binary policy claim — mandatory/voluntary, banned/allowed, confirmed/denied, will/may, declared/withdrawn — the agent must run **two searches**: the affirmative and the negation.

**"Substantive results"** means at least one Tier-1 or Tier-2 source making the opposing claim (per `## Source credibility tiers` below). Social-media speculation does not count.

If the negation returns substantive results, **significance still reflects topic importance** (do not downgrade — that would hide a major policy story behind the SIGNAL tab). Instead the agent:

1. Includes both verbatim quotes side-by-side in the summary.
2. Tags `policy-ambiguity`.
3. Does not pick a side without operator input.
```

New text:

```
### B. Opposing-search (binary policy claims)

For any binary policy claim — mandatory/voluntary, banned/allowed, confirmed/denied, will/may, declared/withdrawn — the agent must run **two searches**: the affirmative and the negation.

**"Substantive results"** means at least one Cred Tier-1 or Cred Tier-2 source making the opposing claim (per `## Source credibility tiers` below). Social-media speculation does not count.

**Tag at write time, regardless of search outcome:** the event gets the `binary-policy` tag whenever Rule B's opposing-search procedure fires. This is the trigger for Rule D (follow-up agency-channel checks) on subsequent cycles. The tag is set whether or not the negation returned substantive results — `binary-policy` means "Rule B procedure ran on this event," not "framing was contested."

If the negation returns substantive results, **significance still reflects topic importance** (do not downgrade — that would hide a major policy story behind the SIGNAL tab). Instead the agent:

1. Includes both verbatim quotes side-by-side in the summary.
2. Tags `policy-ambiguity` (in addition to `binary-policy`).
3. Does not pick a side without operator input.

If the negation returns nothing substantive: event proceeds with `binary-policy` tag only (no `policy-ambiguity`).
```

- [ ] **Step 3: Verify**

```bash
grep -n "Tag at write time, regardless of search outcome\|binary-policy.*means.*Rule B procedure ran" docs/runbooks/pipeline.md
```

Expected: matches confirming the new content is in place.

- [ ] **Step 4: Commit**

```bash
git add docs/runbooks/pipeline.md
git commit -m "$(cat <<'EOF'
Add binary-policy tag at write time for Rule B fires

Tag set whenever the opposing-search procedure fires, regardless
of whether the negation surfaced contradicting framings. Drives
Rule D's trigger condition mechanically (tag check, no
summary-text re-parsing).

Spec: docs/superpowers/specs/2026-05-10-write-time-rigor-amendment.md §3

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Add §D Rule D — follow-up agency-channel checks

**Files:**
- Modify: `docs/runbooks/pipeline.md` (insert new subsection after §C, before "### Explicit non-goals")

- [ ] **Step 1: Locate insertion point**

```bash
grep -n "^### C\. Don't trust\|^### Explicit non-goals" docs/runbooks/pipeline.md
```

Expected: §C heading and "### Explicit non-goals" heading. Rule D inserts between them.

- [ ] **Step 2: Insert §D before "### Explicit non-goals"**

Old text (verbatim, this is the C-to-non-goals boundary):

```
This is the operator-revise-loop in agent-actionable form. There is no marker convention for "operator-confirmed text" in v1 — the rule applies uniformly to all DB content the agent re-encounters.

### Explicit non-goals
```

New text:

```
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

### Explicit non-goals
```

- [ ] **Step 3: Verify**

```bash
grep -n "^### D\. Follow-up agency-channel\|Re-check window\|Preflight (cost control)" docs/runbooks/pipeline.md
```

Expected: three matches.

- [ ] **Step 4: Commit**

```bash
git add docs/runbooks/pipeline.md
git commit -m "$(cat <<'EOF'
Add Rule D — follow-up agency-channel checks

Operational instantiation of Rule C. Events tagged binary-policy
with an agency name get re-checked against agency channels for
7 days from creation, self-extending on each clarification.
Preflight via scrape_log recency keeps cost bounded.

Spec: docs/superpowers/specs/2026-05-10-write-time-rigor-amendment.md §3

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Add tag definition table to write-time rigor section

**Files:**
- Modify: `docs/runbooks/pipeline.md` (insert subsection at end of write-time rigor, before "### Explicit non-goals")

- [ ] **Step 1: Locate insertion point**

After Task 10, the structure is: §A → §A.2 → §B → §C → §D → "### Explicit non-goals". Insert tag table between §D and "### Explicit non-goals".

```bash
grep -n "Operator can grep \`clarifies:\` in feed view\|^### Explicit non-goals" docs/runbooks/pipeline.md
```

Expected: the line ending §D and the explicit-non-goals heading.

- [ ] **Step 2: Insert the tag definition subsection**

Old text:

```
- Reverse lookup: `SELECT * FROM events WHERE 'clarifies:' || $1 = ANY(tags)`.
- Operator can grep `clarifies:` in feed view to spot chains.

### Explicit non-goals
```

New text:

```
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

### Explicit non-goals
```

- [ ] **Step 3: Verify**

```bash
grep -n "^### Tags introduced by this section\|tier-b-unavailable\|policy-clarification" docs/runbooks/pipeline.md
```

Expected: at least three matches.

- [ ] **Step 4: Commit**

```bash
git add docs/runbooks/pipeline.md
git commit -m "$(cat <<'EOF'
Add canonical tag definition table to write-time rigor section

Pins the meaning of every tag introduced by the amendment in one
place: primary-source, paraphrased, policy-ambiguity,
binary-policy, policy-clarification, clarifies:<uuid>,
paywalled-source, tier-b-unavailable, requires-corroboration.

Spec: docs/superpowers/specs/2026-05-10-write-time-rigor-amendment.md §3

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Add §E agent_notes mechanism + worked examples

**Files:**
- Modify: `docs/runbooks/pipeline.md` (insert subsection at end of write-time rigor, after the tag table, before "### Explicit non-goals")

- [ ] **Step 1: Locate insertion point**

```bash
grep -n "^### Tags introduced by this section\|^### Explicit non-goals" docs/runbooks/pipeline.md
```

Expected: the tag-table heading (just added in Task 11) and the explicit-non-goals heading. §E inserts between them.

- [ ] **Step 2: Insert §E**

Old text:

```
| `requires-corroboration` | Cred Tier 3-4 source only; corroboration search returned nothing from Cred Tier 1-2. Held at sig-2. See §1 corroboration vs opposing search. |

### Explicit non-goals
```

New text:

```
| `requires-corroboration` | Cred Tier 3-4 source only; corroboration search returned nothing from Cred Tier 1-2. Held at sig-2. See §1 corroboration vs opposing search. |

### E. agent_notes — internal reasoning trail

For events carrying any of these tags:

- `binary-policy`
- `policy-ambiguity`
- `paraphrased`
- `policy-clarification`

the agent populates the `events.agent_notes TEXT NULL` column with one paragraph of structured prose covering:

- What searches the agent ran (Rule B opposing-search results, corroboration searches if applicable)
- What tier of sources surfaced what
- Why the agent picked this framing
- What follow-up Rule D will perform (if applicable)

Routine descriptive primary-source events (most WHO DONs, CDC HAN updates) do **not** get notes — `agent_notes` stays NULL. The trigger condition is narrow on purpose.

`agent_notes` is internal-only. Public dashboard surfaces (EventCard, map drawer, OG image) project explicit columns and exclude this one. Operator reads via `supabase db query --linked`:

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

### Explicit non-goals
```

- [ ] **Step 3: Verify**

```bash
grep -n "^### E\. agent_notes\|Example 1.*policy-clarification\|Example 2.*binary-policy" docs/runbooks/pipeline.md
```

Expected: three matches.

- [ ] **Step 4: Commit**

```bash
git add docs/runbooks/pipeline.md
git commit -m "$(cat <<'EOF'
Add §E agent_notes mechanism with worked examples

Pins the trigger condition (4 tags), content structure, and
internal-only nature of the events.agent_notes column. Two
examples cover the policy-clarification (Rule D fire) case and
the more common binary-policy + no contradiction case.

Spec: docs/superpowers/specs/2026-05-10-write-time-rigor-amendment.md §4

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Defensive frontend audit — explicit column projection on event fetches

**Files:**
- Modify: `lib/types.ts` (add optional `agent_notes` to Event interface so projections that exclude it stay sound)
- Modify: `app/page.tsx` (replace `.from('events').select('*')` with explicit projection)
- Modify: `app/event/[id]/page.tsx` (same — two `.from('events')` calls in this file)
- Modify: `app/event/[id]/opengraph-image.tsx` (same)
- Modify: `app/case/[case_code]/page.tsx` (same)

- [ ] **Step 1: Enumerate event-fetch sites to confirm scope**

```bash
grep -rn "from\s*(\s*['\"]events['\"]" app/ components/ lib/ 2>/dev/null
```

Expected matches (already audited at plan-write time):
- `app/page.tsx:38`
- `app/case/[case_code]/page.tsx:29`
- `app/event/[id]/opengraph-image.tsx:30`
- `app/event/[id]/page.tsx:13` and `:22`

If the search returns additional sites (component-level subscribers, lib/ helpers), include them in this task.

- [ ] **Step 2: Add `agent_notes` to the Event type as optional/never-projected**

Edit `lib/types.ts`. Old text (the Event interface, lines 15-39):

```typescript
export interface Event {
  id: string;
  created_at: string;
  occurred_at: string | null;
  title: string;
  summary: string;
  raw_content: string | null;
  source_type: SourceType;
  source_url: string | null;
  source_url_hash: string | null;
  source_author: string | null;
  significance: Significance;
  category: Category;
  country_code: string | null;
  region: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  case_count: number | null;
  death_count: number | null;
  is_verified: boolean;
  tags: string[] | null;
  duplicate_of: string | null;
  disease: string;
}
```

New text:

```typescript
// Public projection columns — what the dashboard ever fetches.
// agent_notes is intentionally absent: it's an internal-only column
// (see docs/runbooks/pipeline.md §E) and must never be projected to
// the public client. Use this constant in every .from('events').select(...)
// call on the public surfaces.
export const EVENT_PUBLIC_COLUMNS = [
  'id',
  'created_at',
  'occurred_at',
  'title',
  'summary',
  'raw_content',
  'source_type',
  'source_url',
  'source_url_hash',
  'source_author',
  'significance',
  'category',
  'country_code',
  'region',
  'location_name',
  'latitude',
  'longitude',
  'case_count',
  'death_count',
  'is_verified',
  'tags',
  'duplicate_of',
  'disease',
].join(', ');

export interface Event {
  id: string;
  created_at: string;
  occurred_at: string | null;
  title: string;
  summary: string;
  raw_content: string | null;
  source_type: SourceType;
  source_url: string | null;
  source_url_hash: string | null;
  source_author: string | null;
  significance: Significance;
  category: Category;
  country_code: string | null;
  region: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  case_count: number | null;
  death_count: number | null;
  is_verified: boolean;
  tags: string[] | null;
  duplicate_of: string | null;
  disease: string;
}
```

- [ ] **Step 3: Replace `.select('*')` with `.select(EVENT_PUBLIC_COLUMNS)` in `app/page.tsx`**

Old text (verbatim, lines 37-43):

```typescript
    supabase
      .from('events')
      .select('*')
      .eq('disease', 'hantavirus')
      .is('duplicate_of', null)
      .order('created_at', { ascending: false })
      .limit(50),
```

New text:

```typescript
    supabase
      .from('events')
      .select(EVENT_PUBLIC_COLUMNS)
      .eq('disease', 'hantavirus')
      .is('duplicate_of', null)
      .order('created_at', { ascending: false })
      .limit(50),
```

Also add `EVENT_PUBLIC_COLUMNS` to the import on line 4-6:

Old text:

```typescript
import type {
  Event, Snapshot, CountryStat, Case, CaseLocation, ThreatAssessment, Fact,
} from '@/lib/types';
```

New text:

```typescript
import { EVENT_PUBLIC_COLUMNS } from '@/lib/types';
import type {
  Event, Snapshot, CountryStat, Case, CaseLocation, ThreatAssessment, Fact,
} from '@/lib/types';
```

- [ ] **Step 4: Replace both `.select('*')` calls in `app/event/[id]/page.tsx`**

Read the file first to confirm current content:

```bash
sed -n '1,30p' app/event/[id]/page.tsx
```

For each `.from('events').select('*')` site in this file, replace `'*'` with `EVENT_PUBLIC_COLUMNS`. Add the import at the top:

```typescript
import { EVENT_PUBLIC_COLUMNS } from '@/lib/types';
```

(If the file already imports types from `@/lib/types`, merge the named import per Step 3's pattern.)

- [ ] **Step 5: Replace `.select(...)` in `app/event/[id]/opengraph-image.tsx`**

Same pattern — find the `.from('events')` call (around line 30 per audit), use `EVENT_PUBLIC_COLUMNS` instead of `'*'`. Add the import.

The OG image generator only needs a few fields (id, title, summary, source_type) but using the full public projection is safe and maintains the single source of truth. If the existing select uses a narrow projection like `.select('id, title, summary')`, leave it alone — narrow is also safe (still excludes `agent_notes`).

- [ ] **Step 6: Replace `.select('*')` in `app/case/[case_code]/page.tsx`**

Same pattern — line 29 per audit.

- [ ] **Step 7: Run typecheck**

```bash
npm run typecheck
```

Expected: clean exit. The new `EVENT_PUBLIC_COLUMNS` import resolves, the `.select(EVENT_PUBLIC_COLUMNS)` calls type-check (Supabase typed builders accept string projections), and no other types break.

If typecheck fails because of Supabase generic-type narrowing on `.select(string)` returning `unknown[]`, the safest fix is a small cast where the result is assigned, e.g.:

```typescript
const eventsRes = (await supabase.from('events').select(EVENT_PUBLIC_COLUMNS).eq(...)) as { data: Event[] | null; error: ... };
```

— but only apply this if typecheck actually fails. Most Supabase 2.x clients accept string projections without issue.

- [ ] **Step 8: Run smoke test**

```bash
npm run test:smoke
```

Expected: pass. The smoke test does not assert on `agent_notes` (it doesn't exist in the test), so changing projections should not change smoke results.

- [ ] **Step 9: Commit**

```bash
git add lib/types.ts app/page.tsx app/event/[id]/page.tsx app/event/[id]/opengraph-image.tsx app/case/[case_code]/page.tsx
git commit -m "$(cat <<'EOF'
Switch event fetches to explicit column projection

EVENT_PUBLIC_COLUMNS in lib/types.ts is the single source of truth
for what the dashboard ever fetches from events. Excludes
agent_notes (internal-only per pipeline.md §E). All four
event-fetch sites in app/ updated.

Defensive against accidental SELECT * projection of internal
columns to the public client.

Spec: docs/superpowers/specs/2026-05-10-write-time-rigor-amendment.md §4

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Cross-link updates in pipeline.md

**Files:**
- Modify: `docs/runbooks/pipeline.md` (the §3 cross-link at line 75 and the §5 cross-link at line 136)

- [ ] **Step 1: Update §3 cross-link to mention Rule D**

Read current state:

```bash
grep -n "see \`## Write-time rigor for sig-4\+ items\`" docs/runbooks/pipeline.md
```

Expected: line 75 (in §3) and line 136 (in §5) currently point at §B and §A/§A.2 respectively.

Old text in §3:

```
- For binary policy claims (mandatory/voluntary, banned/allowed, confirmed/denied, will/may, declared/withdrawn), see `## Write-time rigor for sig-4+ items` §B (opposing-search).
```

New text:

```
- For binary policy claims (mandatory/voluntary, banned/allowed, confirmed/denied, will/may, declared/withdrawn), see `## Write-time rigor for sig-4+ items` §B (opposing-search) and §D (Rule D follow-up agency-channel checks on subsequent cycles).
```

- [ ] **Step 2: Update §5 cross-link to mention agent_notes (§E)**

Old text in §5 (line 136):

```
For sig-4+ events, see `## Write-time rigor for sig-4+ items` §A (verbatim quote required) and §A.2 (`primary-source` vs `paraphrased` tagging).
```

New text:

```
For sig-4+ events, see `## Write-time rigor for sig-4+ items` §A (verbatim quote required), §A.2 (`primary-source` vs `paraphrased` tagging), and §E (populate `events.agent_notes` for events carrying `binary-policy`, `policy-ambiguity`, `paraphrased`, or `policy-clarification`).
```

- [ ] **Step 3: Verify both edits**

```bash
grep -n "§B (opposing-search) and §D\|§A.2.*and §E (populate" docs/runbooks/pipeline.md
```

Expected: two matches, one for each cross-link.

- [ ] **Step 4: Commit**

```bash
git add docs/runbooks/pipeline.md
git commit -m "$(cat <<'EOF'
Update pipeline cross-links to reference Rule D and §E (agent_notes)

§3 (Process & score) now points at §B + §D. §5 (Write) now points
at §A + §A.2 + §E. Ensures the rules fire at the point of action
rather than only in the standalone reference section.

Spec: docs/superpowers/specs/2026-05-10-write-time-rigor-amendment.md §3 / §4

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Apply migration(s) to remote prod and verify

**Files:** none modified (remote-DB application).

- [ ] **Step 1: Confirm migration files staged for application**

```bash
ls supabase/migrations/202605100000*.sql
```

Expected: at minimum `20260510000000_events_agent_notes.sql`. If Task 2 produced a conditional migration, also `20260510000001_scrape_log_source_groups.sql`.

- [ ] **Step 2: Apply migrations to remote**

```bash
supabase db push --linked
```

Expected: lists pending migrations and applies them. Acknowledge any prompt to confirm the push.

- [ ] **Step 3: Verify `events.agent_notes` exists on remote**

```bash
supabase db query "SELECT column_name, data_type, is_nullable, col_description('events'::regclass, ordinal_position) AS comment FROM information_schema.columns WHERE table_name='events' AND column_name='agent_notes';" --linked
```

Expected: one row showing `agent_notes | text | YES | <COMMENT TEXT>`.

- [ ] **Step 4: Verify all pre-amendment events have NULL agent_notes**

```bash
supabase db query "SELECT count(*) AS total, count(agent_notes) AS with_notes FROM events;" --linked
```

Expected: `total = N`, `with_notes = 0` (no row has been written with `agent_notes` yet).

- [ ] **Step 5: (If Task 2 produced a migration) Verify `scrape_log.source_type` accepts group:* values**

Only if Task 2 ran. Test with a probe insert:

```bash
supabase db query "INSERT INTO scrape_log (source_type, query, results_found) VALUES ('group:test-probe', 'plan verification', 0) RETURNING id;" --linked
supabase db query "DELETE FROM scrape_log WHERE source_type='group:test-probe';" --linked
```

Expected: insert returns a UUID, delete returns success. If insert fails with a CHECK constraint error, Task 2's migration didn't apply correctly — investigate before continuing.

If Task 2 was a no-op (no CHECK constraint existed), this step is also no-op — no probe needed.

- [ ] **Step 6: No commit (this task is remote-DB application; the migration files were committed in Tasks 1 and 2)**

---

## Task 16: Smoke verification cycle

**Files:** none modified (operator-side verification).

This task requires kicking off a manual pipeline session (per `docs/runbooks/pipeline-operator.md`) and observing the next 5 sig-4+ events written. It's an operator-driven verification, not an agent-side automated check.

- [ ] **Step 1: Operator opens a fresh pipeline session and runs at least one cycle**

Per `pipeline-operator.md` "Starting a session" — open Claude Code in `/Users/claude/Projects/project_contagion`, paste the operator prompt, and let the agent run a full cycle.

- [ ] **Step 2: Wait for ≥5 sig-4+ events to be written (or for 24 cycles to pass)**

Watch the live feed at https://pathwatch-phi.vercel.app or query directly:

```bash
supabase db query "SELECT id, significance, tags, agent_notes IS NULL AS notes_null FROM events WHERE significance >= 4 ORDER BY created_at DESC LIMIT 10;" --linked
```

- [ ] **Step 3: Spot-check 5 most-recent sig-4+ events for rule compliance**

For each of the 5 most-recent sig-4+ events:

- **Rule A:** `events.summary` contains at least one unicode `'…'` quote.
- **Rule A.2:** `events.tags` contains exactly one of `primary-source` or `paraphrased`.
- **Rule B → binary-policy tag:** if the event's claim is binary policy (mandatory/voluntary etc.), `events.tags` contains `binary-policy`. If the claim is not binary policy, `binary-policy` is absent.
- **agent_notes population:** `agent_notes` is non-NULL iff at least one of `binary-policy`, `policy-ambiguity`, `paraphrased`, or `policy-clarification` is in tags.

Query helpers:

```bash
# Spot-check: tag-vs-notes correlation
supabase db query "SELECT id, significance, tags, agent_notes IS NOT NULL AS has_notes FROM events WHERE significance >= 4 AND created_at > now() - INTERVAL '24 hours' ORDER BY created_at DESC;" --linked
```

- [ ] **Step 4: Verify source-list rotation coverage**

```bash
supabase db query "SELECT source_type, max(created_at) AS last_seen, count(*) FROM scrape_log WHERE source_type LIKE 'group:%' GROUP BY source_type ORDER BY last_seen ASC;" --linked
```

Expected:
- Groups 1, 2, 4 appear with recent timestamps (every-cycle pool).
- Groups 3, 5-9 each have at least one entry within the rolling 4-cycle window.
- Groups 10-13 may or may not appear depending on surge.

- [ ] **Step 5: Verify clarification chain mechanism (only if a clarification has been issued during the smoke window)**

If during the smoke cycle Rule D produced a clarification, verify the chain:

```bash
supabase db query "SELECT e1.id AS original, e2.id AS clarification, e2.tags FROM events e1 JOIN events e2 ON 'clarifies:' || e1.id::text = ANY(e2.tags) WHERE e1.created_at > now() - INTERVAL '24 hours';" --linked
```

Expected: rows pairing original events to their clarifications, with `policy-clarification` in the clarification's tags.

If no clarification fired within the smoke window, this step is deferred to operator review on a later cycle.

- [ ] **Step 6: Verify Tier B / Tier C escalation fires (deferrable)**

```bash
supabase db query "SELECT id, source_url, is_verified, tags FROM events WHERE created_at > now() - INTERVAL '24 hours' AND ('paywalled-source' = ANY(tags) OR 'tier-b-unavailable' = ANY(tags)) ORDER BY created_at DESC;" --linked
```

Expected: at least one `paywalled-source` row (Tier C fired) and at least one Tier B success (Reuters/Bloomberg/WaPo/FT URL with `is_verified=true` — query separately if needed).

If no eligible Tier B/C content surfaced in the 24-cycle window, this criterion is deferred to the next 24-cycle window — does not block the amendment landing.

- [ ] **Step 7: No commit; record outcome in operator notes**

This task has no file artifact. Record results in operator runbook completion notes (a file the operator maintains, not committed). If any spot-check fails, surface the failure to the user before marking task 16 complete.

---

## Task 17: Operator confirms Tier B availability from fresh session

**Files:** none modified (operator verification).

- [ ] **Step 1: Operator opens a fresh Claude Code session in the repo**

Same opening as Task 16 (per `pipeline-operator.md` "Starting a session"), but the goal here is a clean Playwright MCP probe, not a full cycle.

- [ ] **Step 2: Operator runs a Playwright navigate against a known Tier B outlet**

In the fresh session, operator types:

```
Use the Playwright MCP server to navigate to https://www.reuters.com/ and return the page title.
```

The agent then calls `mcp__plugin_playwright_playwright__browser_navigate` with `url: "https://www.reuters.com/"` and reports back.

- [ ] **Step 3: Verify success**

Expected output: page title returned, no permission errors. If the agent reports `Tool not available` or a permission denial, the operator's Playwright MCP setup is incomplete — they fix it before continuing (revisit Task 3a).

- [ ] **Step 4: Operator records confirmation in the operator runbook completion notes**

This is an operator-side log, not committed to the repo. Confirms the Tier B prerequisite from Task 3a is concretely working.

- [ ] **Step 5: No commit**

---

## Final review checklist (after Task 17)

- [ ] All 17 tasks complete or explicitly deferred (Task 2 if no CHECK; Task 4 if no rename needed; Task 16 deferred items if no eligible content surfaced).
- [ ] `git log --oneline` shows commits matching each non-deferred task's commit message.
- [ ] `git status` is clean.
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:smoke` passes.
- [ ] `events.agent_notes` exists on remote prod with NULL on all pre-amendment rows.
- [ ] Pipeline operator runbook has Playwright MCP precondition in Prerequisites table.
- [ ] Pipeline runbook has §1 source-list restructure, cadence rule, rotation mechanism, Rule D, tag definition table, §E agent_notes mechanism, and updated cross-links.
- [ ] Public dashboard surfaces never project `agent_notes`.

When all checked: amendment is fully implemented. The original 2026-05-09 spec's acceptance criteria PLUS the amendment's extended criteria (per spec §5 acceptance) are all satisfied.

---

## Notes for the implementer

- **No new tests added** — per the original spec's pattern, verification is operator-on-sight + smoke cycle. Don't manufacture tests for markdown patches.
- **Markdown patches use the Edit tool with exact `old_string` and `new_string`** — the runbook is single-source-of-truth; surgical edits are safer than rewrites.
- **Each task ends in a commit** — the 17 tasks produce up to 13 commits (Tasks 1, 3b, 5-12, 13, 14 always commit; Tasks 2, 4 conditionally commit; Tasks 3a, 15-17 don't commit).
- **Stop and ask if blocked** — per `superpowers:executing-plans`, hit a blocker and stop. Don't guess your way through the conditional Task 2 / Task 4 paths.
- **Pre-flight verification matters** — the conditional behavior of Tasks 2 and 4 hinges on the pre-flight queries. Run them first. The plan's main path assumes the verified-at-plan-write-time state (no CHECK on `scrape_log`, no numeric "access tier" in pipeline.md), so the conditional branches should not fire — but verify.
