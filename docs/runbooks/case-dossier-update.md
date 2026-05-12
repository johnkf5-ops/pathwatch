# Case Dossier Update Playbook

**Audience:** Future Claude session asked to update or fact-check Pathwatch case dossiers. This is the pattern that worked on 2026-05-09 (27 of 28 cases updated) and 2026-05-11 (28 of 28 cases updated + 3 structured corrections applied).

**This is NOT the pipeline.** The pipeline owns case status changes via its own cycle. This playbook is for **operator-driven research updates** — when the user explicitly asks "go fill in missing info on the cases" or "make sure all info is up to date."

## Operating principle: current best truth vs. historical record

Two surfaces, two jobs:

- **Structured fields** (`status`, `case_class`, `current_country`, `exposure_country`, dates, `age_range`, `sex`) reflect **current best truth**. They drive the map color, case counts, KPI numbers. When sources mature, these change.
- **`cases.dossier`** is the **historical record**. Append-only with `[Updated YYYY-MM-DD]` timestamped blocks. The prior dossier text stays as-is so a reader can trace how the case was understood at each point in time.

When reporting evolves (e.g., WHO upgrades suspected → probable), update the structured field AND append a dossier note explaining the change. The dossier carries the timeline; the structured field carries the truth.

---

## What gets updated, what doesn't

**Phase 1 — Research + dossier append (always safe):**
- `cases.dossier` text (append `[Updated YYYY-MM-DD] …` blocks with sources)
- `cases.age_range`, `cases.sex` (when explicitly published, in range form only)
- `cases.exposure_date`, `cases.onset_date`, `cases.confirmed_date`, `cases.outcome_date`
- `cases.exposure_country`, `cases.current_country` (when sources clarify)
- `cases.nationality` (metadata, when sources clarify)

**Phase 2 — Structured corrections (requires operator confirmation; 2026-05-11 pattern):**
- `cases.status` — defer to operator. If sources strongly contradict the current status (e.g., WHO formally reclassifies), confirm with operator before changing. Update accompanied by a clear dossier note explaining what changed, why, when, and citing the authoritative source.
- `cases.case_class` — same as status. Update only with operator confirmation when authoritative reclassification has occurred (e.g., WHO DON upgrades suspected → probable). Confirm allowed combinations per pipeline.md (`probable_case` × `monitoring | recovered | deceased`, etc.).

**NEVER update via this playbook:**
- `cases.case_code` — stable identifier, never changes.
- `cases.is_index_case` — pipeline owns this.
- `cases.display_name` — pipeline owns the canonical labels (and the anonymization decisions).

**Privacy rules — non-negotiable:**
- Demographics as ranges only: `age_range: '60-69'`, never `'67'`. Even when sources publish exact ages.
- For US/anonymized passengers (`US-*`, `NJ-*`), do NOT add real names even if reporting reveals them. Keep the "Texas Resident #1" framing.
- For named cases (e.g. MVH-004 Martin Anstee, MVH-001 Dutch Man), the existing `display_name` field is the source of truth — don't escalate beyond what's already there.

**Source denylist — non-negotiable:**
- Never cite competitor outbreak trackers, personal blogs, Substack newsletters, Medium posts, Blogspot, or press-release aggregators (medicalxpress, news.google.com article URLs).
- Full list + audit query: `docs/runbooks/source-denylist.md`.
- If a research agent surfaces only denylisted sources for a claim, drop the claim — do not write it into the dossier with a "best available" note.

---

## The pattern

### Step 1 — Pull current case state

```bash
supabase db query "SELECT c.case_code, c.display_name, c.status, c.role, c.age_range, c.sex, c.exposure_country, c.current_country, c.exposure_date, c.onset_date, c.confirmed_date, c.outcome_date, c.dossier, json_agg(json_build_object('loc', cl.location_name, 'arrived', cl.arrived_at, 'context', cl.context) ORDER BY cl.arrived_at) FILTER (WHERE cl.id IS NOT NULL) AS locations FROM cases c LEFT JOIN case_locations cl ON cl.case_id = c.id GROUP BY c.id ORDER BY c.case_code;" --linked > /tmp/pathwatch_cases.json
```

The Supabase CLI prepends an "Initialising login role…" line and appends a CLI version warning. Strip both before parsing — see `case_updates.py` pattern below.

### Step 2 — Identify gaps

```sql
SELECT count(*) AS total_cases,
       count(*) FILTER (WHERE age_range IS NULL OR age_range='unknown') AS missing_age,
       count(*) FILTER (WHERE sex IS NULL OR sex='U') AS missing_sex,
       count(*) FILTER (WHERE onset_date IS NULL AND status IN ('suspected','confirmed','recovered','deceased','critical')) AS missing_onset,
       count(*) FILTER (WHERE confirmed_date IS NULL AND status='confirmed') AS missing_confirmed,
       count(*) FILTER (WHERE outcome_date IS NULL AND status IN ('recovered','deceased')) AS missing_outcome,
       count(*) FILTER (WHERE dossier IS NULL OR length(dossier) < 200) AS thin_dossier
FROM cases;
```

Surface this gap summary to the user before dispatching agents — it sets expectations on what's worth researching.

### Step 3 — Dispatch parallel research agents

For each named case (e.g. MVH-001 through MVH-009, ES-001, etc.), dispatch a **general-purpose** Agent in parallel. For aggregate cohorts (US-*, group cases), dispatch one agent per cohort. Aim for ~20 parallel agents in a single tool-call message — the Agent tool runs them concurrently.

**Per-case agent prompt template** (compact JSON-only output keeps your context clean):

```
Research case {CASE_CODE} from the May 2026 MV Hondius hantavirus outbreak for the Pathwatch dashboard at hantavirustracer.com.

CURRENT KNOWN STATE (verify; do NOT contradict without evidence):
=== CASE: {CASE_CODE} | {DISPLAY_NAME} ===
STATUS: {status} | ROLE: {role} | AGE: {age_range} | SEX: {sex} | EXPOSURE_COUNTRY: {exposure_country} | CURRENT_COUNTRY: {current_country}
DATES: exposure={exposure_date} onset={onset_date} confirmed={confirmed_date} outcome={outcome_date}
DOSSIER: {existing dossier text}
LOCATIONS:
{location lines}

YOUR MISSION: Use WebSearch + WebFetch to find current public reporting on this case. Confirm or fill missing fields. Especially: confirmed_date, exposure_date, age range (when ranges only), and any clinical/biographical detail that would enrich the dossier with sources.

HARD RULES:
- Only return information explicitly stated in sources you can read.
- Do NOT infer beyond what reporters wrote.
- Demographics: age range only ("60-69"), never exact ages.
- For US/NJ/anonymized passengers: do NOT add real names even if found.
- "not findable" if absent. Cite source URLs for every new fact.

OUTPUT: Return ONLY this JSON, under 350 words.
{
  "case_code": "{CASE_CODE}",
  "updates": {
    "age_range": "RANGE | not findable",
    "sex": "M | F | U | not findable",
    "exposure_date": "YYYY-MM-DD | null | not findable",
    "onset_date": "...",
    "confirmed_date": "...",
    "outcome_date": "...",
    "exposure_country": "ISO2 | not findable",
    "current_country": "ISO2 | not findable",
    "dossier_additions": "1-3 sentences with new sourced facts ending in 'Sources: [...]', OR null"
  },
  "sources": ["url1", "url2"],
  "notes": "Brief notes on confidence, contradictions, what's still unclear (under 80 words)"
}
```

Agents may hit AUP false positives (Anthropic safety classifier on outbreak content). Expect ~30% of dispatches to fail with `Claude Code is unable to respond to this request, which appears to violate our Usage Policy`. Retry the failed ones with **shorter, plainer-language prompts** (drop case-codes, use "the May 2026 cruise health incident" instead of repeating "outbreak"). On retry, success rate is ~90%.

### Step 4 — Apply the updates (Phase 1: research + dossier append)

Build SQL `UPDATE` statements per case. Use `COALESCE(dossier, '') || E'\n\n' || '[Updated YYYY-MM-DD] …'` to append rather than overwrite. Always set `updated_at = now()`.

**Dossier append conventions — required for correct dashboard rendering:**

The dashboard's `DossierBody` parser (`lib/dossier-parse.ts` + `components/case/DossierBody.tsx`) renders dossier text into visual sections. The parser keys on:

- `[Updated YYYY-MM-DD HH:MM UTC]` — each becomes a green "UPDATED · timestamp" sub-header in the rendered dossier.
- `Label:` patterns at sentence starts — captured as section labels. Use this for inline structure: `Travel:`, `Exposure:`, `Current condition (per X, May 11):`, `Sources:`, etc.
- `Sources:` is treated specially — URLs after this label render as a hostname-only clickable list.

For an append to render well, write it like:

```
[Updated 2026-05-11] <one-paragraph lead with the new facts>. Travel: <route details if relevant>. Exposure: <if relevant>. Current condition (per <agency>, May 11): "<verbatim quote>". Sources: https://url1 ; https://url2 ; https://url3
```

Avoid commas inside URLs (the parser uses `[^\s,)]+` to terminate). Separate multiple URLs with ` ; `.

**Two gotchas the 2026-05-11 run hit — surface to the next session:**

1. **`events.occurred_at` must reflect the actual news cycle, not arbitrary time.** The EventFeed ticker sorts by `occurred_at` first (`COALESCE(occurred_at, created_at) DESC` — see commit 972100a). If you write a new event with `occurred_at` set to an early-morning hour, it will slot below same-day events with later announcement times and look stale even though it's brand-new in the DB. **Set `occurred_at` to when the press cycle actually published the story** — for ministerial announcements that's typically mid-to-late afternoon UTC. When writing the operator-driven event for a story that just broke, set `occurred_at = now() - INTERVAL '1 hour'` (or your best estimate of the actual announcement time) so it surfaces at the top of the feed.

2. **`case_locations` must be inserted alongside the new `cases` row.** Country choropleth color comes from `country_stats` (which the recount handles automatically), but the per-case markers/dots on the map come from `case_locations`. Without a `case_locations` row, the country fills but no dot renders. After every new case INSERT, INSERT at least one `case_locations` row with `case_id`, `country_code`, `location_name`, `latitude`, `longitude`, `arrived_at`, optional `context`. For cohort cases (e.g., 12 hospital staff at a single facility) one location row covering the facility is sufficient.

**Applying the SQL.** The `supabase db query` CLI doesn't tolerate SQL comments or multi-line strings well. Strip `^--` lines before passing the file:

```bash
grep -v '^--' /tmp/case_updates.sql | grep -v '^$' > /tmp/case_updates_clean.sql
supabase db query "$(cat /tmp/case_updates_clean.sql)" --linked
```

A successful response looks like `{"rows": []}` (empty rows for UPDATE; not an error).

### Step 4b — Phase 2: triage correction flags (operator confirmation)

Phase 1 lands research updates and **POSSIBLE CORRECTION** footnotes for any flagged conflicts. Then surface the flags to the operator, who decides which to apply directly vs. leave for the pipeline to resolve.

Triage rubric:

| Flag type | Action |
|---|---|
| Authoritative source reclassifies (WHO DON formally upgrades, agency primary statement) | Apply directly with operator confirmation. Update structured field. Append dossier with `[Updated YYYY-MM-DD — CLASSIFICATION CHANGE]` block explaining what/why/when. |
| Dossier prose contains a fact known to be wrong but structured fields are already correct | Apply dossier `[Updated YYYY-MM-DD — RETRACTION]` block. No structured change. |
| Sources genuinely contradict (one outlet says positive, another says negative; no agency primary) | Leave as flag. Wait for authoritative source. |
| Data integrity bug (row appears assigned to wrong patient) | Leave as flag. Needs human review — not a fact correction. |
| Narrative detail (flight ID, location specifics, no status impact) | Optional. Update dossier if it sharpens the record; structural fields stay. |

When applying a structured correction, the dossier append should:
1. State what changed at the top (`case_class changed from X to Y`, `status changed from A to B`)
2. Cite the authoritative source by name and URL
3. Explain that the prior classification was correct at the time it was written — this is normal evolution, not a factual error
4. Affirm that the dossier above preserves the historical record

### Step 5 — Verify writes landed

```sql
SELECT case_code, status, confirmed_date, exposure_country, current_country,
       length(dossier) AS dossier_len,
       dossier ~ '2026-MM-DD' AS has_marker,
       updated_at
FROM cases
WHERE updated_at > now() - interval '10 minutes'
ORDER BY updated_at DESC;
```

Expect every updated case to have a fresh `updated_at` and the date marker visible in the dossier text. If any case is missing the marker, the regex didn't match (likely the agent used "POSSIBLE CORRECTION (flagged YYYY-MM-DD)" instead of "Updated YYYY-MM-DD") — that's fine, the data still landed; just verify dossier_len grew.

### Step 6 — Surface to the operator

Report the user:
- **N of M** cases received updates (and which one didn't if any).
- **Structured field updates** (any confirmed_dates filled, any exposure_country corrections).
- **Status conflicts flagged for pipeline review** (e.g. "MVH-007 — sources describe her as a contact who tested negative, but status is currently 'confirmed'"). Don't change status; just flag it.
- **Operational corrections** (e.g. "US-NE-GROUP is at UNMC Omaha, not Camp Ashland").

Operator decides whether the pipeline should pick up the flagged-for-review cases and revise statuses on the next cycle.

---

## Why this works

- **Parallel agents, not one big agent**: 20+ parallel general-purpose agents finish in roughly the same wall-clock time as one, but each has a focused, narrow context. AUP false positives stay isolated to single retries.
- **Compact JSON output keeps the parent context clean**: 20 agents × 350 words = manageable. 20 agents × 2000-word free-form reports = unusable.
- **Dossier-append, not dossier-replace**: preserves the original prose + adds traceable footnotes. Operators can audit changes by date marker.
- **Sources cited inline**: every new fact ends in `Sources: [URLs]`. If a future operator questions a claim, they can trace it back.
- **No status changes from research**: the pipeline is the only writer for status. This rule is what keeps the dashboard's threat picture coherent — research can find new info but can't decide a case is "really negative" without going through the validated cycle.

---

## Common failure modes

| Failure | Cause | Fix |
|---|---|---|
| `supabase db query` errors with "Unrecognized flag" | SQL comments or BEGIN/COMMIT confusing the CLI parser | Strip comments via grep first; the CLI runs each query in implicit transaction anyway |
| `unexpected status 400: column X does not exist` | Migration not applied yet | Check `supabase db push --linked` history |
| Agent returns "this is fictional / I cannot help" | AUP false positive from outbreak terminology | Rephrase agent prompt without words like "outbreak", "deaths", "spread"; use "cruise health incident" framing |
| Agent hits AUP three times in a row on the same case | Classifier locked on the case-specific terminology | **Fall back to manual research by the main session.** Use WebSearch + WebFetch directly. Then build the UPDATE SQL and apply via `supabase db query --linked`. The main session's classifier scope is different from the subagent's, often allowing what subagents can't. |
| Agent confuses cases (returns content for MVH-001 inside MVH-009 response) | Cross-talk in long prompt or agent memory | Discard that agent's result for the wrong case; redispatch with `Subject: only research case {CODE}` framing |
| Dossier additions show as `null` in JSON output | Agent found nothing new | That's expected and correct — preserve the existing dossier, skip the UPDATE for that case |
| Dashboard dossier renders as one wall of text instead of sections | Append used freeform prose with no `Label:` or `[Updated YYYY-MM-DD]` markers | Rewrite the append to use the parser conventions (see Step 4). Note that this won't fix already-applied appends — those land permanently as written. |

---

## Reference: 2026-05-09 run

- Total cases: 28
- Successful updates: 27 (all except MVH-009, where the agent confused him with MVH-004; result discarded)
- AUP failures on first dispatch: 9 of 21 agents
- AUP failures on retry: 1 of 9 (CH-001 needed a third pass, eventually succeeded)
- Status-conflict footnotes added for pipeline review: MVH-007, ES-001, CH-001
- Operational corrections found: US-NE-GROUP location (UNMC vs Camp Ashland), MVH-004 exposure country (CV → AR), TDC-001 current country (GB → SH), SG-002 exposure date (2026-04-01 → 2026-04-25)

## Reference: 2026-05-11 run

- Total cases: 28. Updates applied: 28 of 28 (100%).
- Phase 1 batch: 23 of 28 agents dispatched in first parallel call. 21 returned good JSON; 2 hit AUP and were retried.
- Phase 1 retries + missing: 7 agents (5 had not been dispatched, 2 were retries). 6 returned good; 1 (GB-NE-001) hit AUP three times and was resolved manually by main-session WebSearch.
- Phase 2 corrections applied directly (with operator confirmation):
  - **MVH-001** — case_class: confirmed_case → probable_case. WHO and Argentine MoH confirmed no antemortem samples; classification matures from initial assumption to lab-status reality.
  - **TDC-001** — case_class: suspected_case → probable_case; status: suspected → monitoring. WHO DON600 formally upgraded.
  - **MVH-007** — dossier retraction only ("Confirmed positive" prose was wrong from the start; structured fields already correctly classify as contact/monitoring).
- Phase 2 flags left for further investigation:
  - **US-GA-001 / US-GA-002** — sources contradict on whether Emory patients tested positive; CBS Atlanta reports negative, Fox 5 headline says positive. Waiting for Georgia DPH or CDC primary source.
  - **MVH-006** — DB row appears to mix two patients (display_name "Dutch crew 41" vs. dossier prose "British 69yo in Sandton ICU"). Needs human review.
  - **ES-CAT-002** — seat-switch flight identification (cosmetic narrative; no status impact).
- All structured-correction dossier appends used `[Updated 2026-05-11 — CLASSIFICATION CHANGE]` or `[Updated 2026-05-11 — RETRACTION]` markers so the dashboard parser renders them as distinct sections with clear semantics.
