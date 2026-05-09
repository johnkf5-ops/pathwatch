# Case Class Enum — Design Spec

**Status:** Designed 2026-05-09. Not yet implemented. Pick this up in a future session.
**Author:** Claude (drafted after the 2026-05-09 case-table audit reconciliation)
**Related:** `docs/superpowers/specs/2026-05-09-pipeline-api-rebuild-design.md`

---

## Goal

Disambiguate **what kind of row** a `cases` entry represents from the **lifecycle state** of that row, by adding a new `case_class` enum column. Today both concepts collapse into the `status` field, which is why contacts under monitoring get counted alongside lab-confirmed cases — inflating the TRACKED tile and making the dashboard say "26 cases" when WHO ground truth is 8.

## Non-goals

- No change to lifecycle: `status` enum (monitoring / suspected / confirmed / recovered / deceased / critical) stays as-is.
- No mass-rewrite of existing dossier text.
- No UI redesign of the case dossier panel — only the **counts** and **filters** that read across cases change.
- Not the pipeline rebuild — that's a separate doc.

## Why now

Today's audit found the dashboard was showing a TRACKED count that mixed:
- 6 confirmed-by-lab cases
- 2 probable cases (clinically presented, no lab)
- 1 suspected case (TDC-001 on Tristan da Cunha)
- 17 contacts under monitoring (US passengers, NJ residents, KL592 attendant, etc.)
- 3 deceased (subset of confirmed)

WHO DON600 publicly reports the number as `8 cases (6 confirmed + 2 probable), 3 deaths`. Our dashboard cannot reproduce that number from the schema without manual filtering. That's a structural problem.

---

## 1. Schema change

### Migration: add `case_class` column to `cases`

```sql
-- supabase/migrations/<TS>_cases_class_enum.sql

ALTER TABLE cases
  ADD COLUMN case_class TEXT
    CHECK (case_class IN (
      'confirmed_case',
      'probable_case',
      'suspected_case',
      'contact',
      'returnee'
    ));

CREATE INDEX idx_cases_class ON cases (case_class);
CREATE INDEX idx_cases_class_disease ON cases (disease, case_class);
```

`case_class` is **nullable initially** so the migration is non-blocking. After backfill (below), a follow-up migration sets `NOT NULL`.

### Enum semantics (operator-facing definitions)

| `case_class` | Meaning | Counts toward "cases"? |
|---|---|---|
| `confirmed_case` | Lab-confirmed infection (PCR, serology) | Yes — primary count |
| `probable_case` | Clinically consistent + epidemiologically linked, no lab confirmation | Yes — secondary count |
| `suspected_case` | Symptomatic but neither lab-confirmed nor probable | Yes — tertiary count |
| `contact` | Known exposure to a case, monitored even if asymptomatic | **No** — tracked, not counted as case |
| `returnee` | Returned from exposure area without known direct contact, monitored as precaution | **No** — tracked, not counted as case |

### Relationship to `status`

`case_class` answers *"what kind"*, `status` answers *"where in lifecycle."* Most combinations are valid:

- `confirmed_case` × `monitoring | recovered | deceased | critical` — typical
- `probable_case` × `monitoring | recovered | deceased` — typical
- `contact` × `monitoring | recovered` — never `deceased` (would promote to confirmed_case)
- `returnee` × `monitoring | recovered` — same

A trigger or pipeline rule could enforce: when a `contact` becomes positive, promote `case_class` to `confirmed_case` (and the pipeline writes a `case_relationships` edge). Out of scope for this spec — operator does it manually.

---

## 2. Backfill rules

A second migration backfills `case_class` for existing rows. The mapping uses `display_name` patterns and `status`:

```sql
-- supabase/migrations/<TS>_cases_class_backfill.sql

-- Confirmed cases: status='confirmed' or 'deceased' AND not labeled as a "Contact" or "Resident"
UPDATE cases SET case_class = 'confirmed_case'
WHERE status IN ('confirmed', 'deceased', 'critical');

-- Probable: postmortem confirmed but lab status unclear (case-by-case manual; spec lists the codes)
-- (Run as a separate manual UPDATE pass after the bulk backfill)

-- Suspected: status='suspected'
UPDATE cases SET case_class = 'suspected_case'
WHERE status = 'suspected';

-- Returnees: US-* passengers and similar bulk-monitored cohorts (post-trip, no direct case contact)
UPDATE cases SET case_class = 'returnee'
WHERE status = 'monitoring'
  AND (case_code LIKE 'US-%' OR case_code = 'US-NE-GROUP' OR case_code LIKE 'SG-%');

-- Contacts: everyone else with status='monitoring' (NJ-001, NJ-002, KL-001, CA-001, FR-001, ES-CAT-002, MVH-007 post-reclass)
UPDATE cases SET case_class = 'contact'
WHERE status = 'monitoring' AND case_class IS NULL;

-- Recovered: keep their original class (set during their active phase)
-- If somehow null after backfill, default to 'contact'
UPDATE cases SET case_class = 'contact'
WHERE case_class IS NULL;
```

Pipeline writes (the future API rebuild) include `case_class` from row creation forward — no more backfill needed.

After backfill verify, then ship the NOT NULL migration:

```sql
-- supabase/migrations/<TS>_cases_class_required.sql
ALTER TABLE cases ALTER COLUMN case_class SET NOT NULL;
```

---

## 3. UI changes

### TopBar `CASES` chip

Currently reads `snapshot.total_cases`. After this fix:

```ts
// New count: cases only (confirmed + probable + suspected). Ignores contacts/returnees.
const casesCount = cases.filter(c =>
  c.case_class === 'confirmed_case' ||
  c.case_class === 'probable_case' ||
  c.case_class === 'suspected_case'
).length;
```

Optional: split into two chips: `CASES X (Y confirmed)` showing the WHO-style breakdown.

### KPI HUD on map

Currently shows `CASES`, `TRACKED`, `DEATHS`, `FATALITY RATE`, `COUNTRIES`. After:

- `CASES` = cases-only count (as above)
- `CONTACTS` = `contact` + `returnee` count (new, replaces `TRACKED`)
- `DEATHS` = unchanged
- `FATALITY RATE` = `deaths / cases` (correct denominator now)
- `COUNTRIES` = unchanged

Adds 1 row to the HUD; total height grows ~24px. Negligible.

### MonitoringCohort panel

Add a small filter chip row at the top: `ALL · CONTACTS · RETURNEES`. Default ALL. Lets the operator separate the two cohorts (NJ contacts vs. US passenger returnees) at a glance.

### PostureMatrix (Countries Affected)

Per-country `cases` count in `country_stats` should now mean **case_class IN (confirmed, probable, suspected)** — not contacts. May require a per-country recount migration. Use the rule:

```sql
-- Recount country_stats.cases from cases table by class
UPDATE country_stats cs
SET cases = (
  SELECT count(*) FROM cases c
  WHERE c.disease = cs.disease
    AND c.exposure_country = cs.country_code
    AND c.case_class IN ('confirmed_case','probable_case','suspected_case')
);
```

(Or use `current_country` instead of `exposure_country` depending on the desired semantic — pick one consistently and document.)

### Map markers

Already color-coded by status. After this fix, `contact` and `returnee` rows render as **hollow dashed cyan** (matches existing monitoring style). `confirmed_case`, `probable_case`, `suspected_case` render with **filled red/amber/green** per their status. The visual distinction reinforces the conceptual one.

### Snapshot fields

`snapshot.total_cases` gains explicit semantics: cases only (confirmed + probable + suspected). Add a new column `total_contacts INTEGER` for the contact + returnee count. Pipeline Phase 2 writes both.

```sql
-- supabase/migrations/<TS>_snapshots_total_contacts.sql
ALTER TABLE snapshots ADD COLUMN total_contacts INTEGER;
```

---

## 4. Pipeline integration

When the API rebuild ships (separate spec), Phase 1 prompts get an extra rule:

> When writing a new case, classify it:
> - `confirmed_case` if a Tier-1 source explicitly says PCR-confirmed or lab-positive
> - `probable_case` if a Tier-1 source describes the case as probable / postmortem positive / strong epi link without lab
> - `suspected_case` if symptomatic but no lab and not probable per source
> - `contact` if known direct exposure to a case but not yet symptomatic-and-tested
> - `returnee` if returned from an exposure area without direct contact

Phase 2 (analysis) reads `case_class` to compute the threat-assessment correctly:

- R0 denominator = confirmed + probable cases only
- SAR uses contacts as denominators, confirmed_cases-from-contacts as numerator
- Pandemic probability respects the WHO framing (cases vs. contacts)

The pipeline runbook (`docs/runbooks/pipeline.md`) gets updated with the classification rules.

---

## 5. Out of scope

- No automatic class promotion (contact → confirmed_case on positive test). Operator handles transitions, OR a future pipeline rule adds it.
- No retro-compatibility wrapper view. Old code that read `cases.status='monitoring'` and assumed "case" must be updated to filter on `case_class` too.
- No deeper privacy review of existing dossiers — that's a separate audit pass.
- No threat_assessments schema change. Phase 2 just reads more fields.

## 6. Migrations summary (4 total)

1. `<TS>_cases_class_enum.sql` — add nullable column + indexes
2. `<TS>_cases_class_backfill.sql` — populate based on existing data
3. `<TS>_cases_class_required.sql` — set NOT NULL after backfill verified
4. `<TS>_snapshots_total_contacts.sql` — add `total_contacts` column

Each can ship independently. Migrations 1+2 can deploy together; 3 ships after verification; 4 can ship anytime (defaults to NULL until pipeline writes it).

---

## 7. Decisions log

| Decision | Choice | Why |
|---|---|---|
| New column or repurpose `status`? | New column `case_class` | `status` is lifecycle, `case_class` is type — orthogonal concepts, shouldn't collapse |
| Distinguish `contact` from `returnee`? | Yes | Operationally different — contacts have direct exposure; returnees are precautionary |
| Auto-promote on positive test? | No | Out of scope; operator-driven for now |
| Per-country recount migration? | Yes | `country_stats.cases` is currently inflated by contacts, needs reset |
| Update KPI HUD? | Yes — replace `TRACKED` with `CONTACTS` | The TRACKED tile was the most visibly misleading number |
| Update pipeline prompts? | Yes | Phase 1 must classify on row creation; Phase 2 must respect the split |

---

## 8. Resolved decisions (formerly open questions)

- **`country_stats.cases` uses `current_country`.** "Where the case is now" matches the dashboard's geographic intent (markers and PostureMatrix both reflect current location). A future `exposed_in_country` count can be added separately if needed.
- **Suspected cases count toward CASES.** The filter is `case_class IN ('confirmed_case','probable_case','suspected_case')` everywhere. No separate `confirmed+probable` chip in this iteration — keeps the UI simple. WHO-style breakdown can be a follow-up.
- **All `case_class` × `status` combinations allowed**, except the invalid pairs noted in §1: `contact` and `returnee` cannot be `deceased` or `critical` (those promote to `confirmed_case` first). The DB CHECK constraint enforces only the enum membership; pipeline/operator logic enforces the relationship rule.

---

## 9. Verification plan (post-implementation)

After all 4 migrations applied + UI updated + pipeline updated:

1. `SELECT case_class, count(*) FROM cases GROUP BY case_class;` — expect a sensible distribution. Right now: probably ~3 confirmed, ~5 probable/suspected, ~17 contact/returnee.
2. Dashboard TopBar CASES chip should match WHO DON600 ground truth. If WHO says 8 (6+2), our chip says 8.
3. KPI HUD CONTACTS chip should match the visible MonitoringCohort count.
4. PostureMatrix per-country `cases` totals should match the per-country WHO breakdown. CH=1, ES=1, GB=1, NL=2, ZA=2, CV=1, DE=1 → 9 case-bearing countries. (Not 7 — WHO's 7 was earlier; we recount from our own classified rows.)
5. Smoke: Playwright test that asserts CASES chip integer equals `confirmed + probable + suspected` count.

---

## 10. Effort framing (for next session)

This is a contained sub-project. Single brainstorm → single plan → ~10-15 task implementation. The plan should split into:

1. Phase 1: Migrations 1+2 (additive, non-breaking)
2. Phase 2: UI updates (TopBar count, KPI HUD, PostureMatrix recount, MonitoringCohort filter chips)
3. Phase 3: Pipeline updates (Phase 1 prompt classification rule + Phase 2 analytical reads)
4. Phase 4: Migrations 3+4 (NOT NULL + total_contacts)
5. Phase 5: Verification + smoke test

Each phase is independently shippable. Phases 1 and 2 can ship together to fix the visible TRACKED-tile inflation without waiting on the pipeline rebuild.

When picking this up: invoke `superpowers:brainstorming` first to confirm scope hasn't shifted (e.g., the pipeline rebuild may already be in flight), then `superpowers:writing-plans` to convert this spec into the task-by-task plan.
