# Pathwatch — Threat Assessment & Polymarket Integration

**Date:** 2026-05-08
**Source spec:** `/Users/claude/Downloads/PATHWATCH_THREAT_ASSESSMENT_SPEC.md` (refined via conversation 2026-05-08)
**Depends on:** Sub-projects 1–3, intel-feed restore, Palantir traces (all on `main`).

---

## Goal

Add a real-time threat assessment layer to Pathwatch:
1. **Threat assessment** — Claude's structured probability that this outbreak becomes a widespread public health emergency, with reasoning, signal pills, and trigger watchlist. Updated each pipeline cycle.
2. **Polymarket comparison** — Live prediction-market odds shown alongside the AI assessment so the user can see where crowd consensus agrees or diverges with the data-driven view.

Lets the user track the outbreak directly off DB+market signals instead of relying on media.

---

## Architecture

- **One snapshot row per pipeline cycle** in a new `threat_assessments` table. Latest row drives the UI.
- **Pipeline-side fetch** (Cowork/human-driven): Claude pulls the four Polymarket odds via the public Gamma API, reassesses pandemic probability against the trigger list, and inserts a new row only on material change (>1% shift or trigger trip).
- **Frontend**: a slim banner strip under the TopBar (full-width, single row of: pandemic % + threat-level chip + Polymarket delta + expand chevron). Click expands to a full panel with reasoning, signal pills, and trigger watchlist.
- **Triggers list lives in config** (`lib/threat-triggers.ts`), not seed data. Schema only stores which trigger names are currently *watching* vs *tripped* per assessment.

---

## Schema (refined)

```sql
CREATE TABLE threat_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  disease TEXT DEFAULT 'hantavirus' NOT NULL,

  -- Provenance
  model TEXT NOT NULL,                         -- e.g. 'claude-opus-4-7'
  pipeline_session_id TEXT,                    -- Cowork session id / pipeline run id

  -- Core assessment
  pandemic_probability DOUBLE PRECISION NOT NULL CHECK (pandemic_probability BETWEEN 0 AND 1),
  threat_level TEXT NOT NULL CHECK (threat_level IN ('minimal','low','moderate','elevated','high','critical')),
  summary TEXT NOT NULL,
  reasoning TEXT NOT NULL,

  -- Input signals
  r0_estimate DOUBLE PRECISION,
  r0_assessment TEXT,
  mutation_status TEXT CHECK (mutation_status IN ('none_detected','monitoring','concerning','critical')),
  mutation_notes TEXT,
  secondary_attack_rate DOUBLE PRECISION,
  secondary_attack_notes TEXT,
  case_doubling_days DOUBLE PRECISION,
  containment_effectiveness TEXT CHECK (containment_effectiveness IN ('effective','partially_effective','failing','unknown')),

  -- Polymarket signals (raw, no derived delta)
  polymarket_pandemic_odds DOUBLE PRECISION,
  polymarket_us_case_odds DOUBLE PRECISION,
  polymarket_vaccine_odds DOUBLE PRECISION,
  polymarket_lab_leak_odds DOUBLE PRECISION,
  polymarket_fetched_at TIMESTAMPTZ,
  ai_vs_market_note TEXT,

  -- Trigger state for this snapshot
  triggers_watching TEXT[] NOT NULL DEFAULT '{}',
  triggers_tripped TEXT[] NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_threat_created ON threat_assessments (created_at DESC);
CREATE INDEX idx_threat_disease ON threat_assessments (disease);
ALTER TABLE threat_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY threat_public_read ON threat_assessments FOR SELECT USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE threat_assessments;
```

**Refinements vs source spec:**
- Added `model` and `pipeline_session_id` for attribution (people will ask "who said this").
- Removed `ai_vs_market_delta` column — derived value, computed on read.
- Triggers stored as `TEXT[]` of names; canonical names + escalation rules live in `lib/threat-triggers.ts`.

---

## Polymarket integration

| Market | Slug | Use |
|---|---|---|
| Hantavirus pandemic 2026 | `hantavirus-pandemic-in-2026` | Primary AI-vs-market comparison |
| US case by May 15 | `confirmed-case-of-hantavirus-in-us-by-may-15` | Near-term risk signal |
| Vaccine in 2026 | `hantavirus-vaccine-in-2026` | Severity perception signal |
| Lab leak by June 30 | `hantavirus-lab-leak-confirmed-by-june-30-1` | Origin-conspiracy signal |

- API: `GET https://gamma-api.polymarket.com/events?slug=<slug>` — no auth, extract YES price from market tokens.
- **First plan task: verify all four slugs return data.** If any fail, drop that column from the v1 UI and leave the schema field nullable (already is).
- Pipeline writes `polymarket_*_odds` and `polymarket_fetched_at`; UI shows whichever fields are non-null.

---

## Frontend

### Components
```
components/threat/
├── ThreatBanner.tsx            -- slim full-width banner under TopBar
├── ThreatPanelExpanded.tsx     -- expanded panel: probability meter + reasoning + signals + triggers + market
├── ProbabilityMeter.tsx        -- big pct + threat-level chip
├── PolymarketComparison.tsx    -- AI % vs market %, computed delta
├── SignalIndicators.tsx        -- row of colored pills (R0, mutations, SAR, containment, doubling)
└── TriggerWatchlist.tsx        -- watching vs tripped, color-coded
```

### Layout

- **Banner**: full-width strip beneath `TopBar`. One row containing:
  - Threat-level dot + label (intel-terminal palette: green / blue / amber / orange / red / dark-red — reuse existing tokens, no new colors).
  - Pandemic probability `3.5%` in large mono.
  - `vs MARKET 9.0%` with `Δ` chip showing absolute delta and direction.
  - `EXPAND ▾` chevron on right. Clicking toggles the expanded panel below the banner.
- **Expanded panel** mounts in-place between banner and existing dashboard. Contains the four sub-components stacked.
- Sit-rep grid layout below is unchanged.

### Color tokens (reuse, no new)

| Threat level | Token in use | Hex |
|---|---|---|
| minimal | green | `#2ee37a` |
| low | text-secondary | `#8a93a8` |
| moderate | amber/confirmed | `#f5b041` |
| elevated | orange/critical | `#ff7f3f` |
| high | red/deceased | `#ff4d5e` |
| critical | red bg-tinted | `#ff4d5e` w/ `#1a0a0d` background |

---

## Triggers (config, not seed)

`lib/threat-triggers.ts` exports:
```ts
export const TRIGGERS = [
  { id: 'airborne_transmission', label: 'Confirmed airborne transmission case', escalateTo: 'elevated' },
  { id: 'r0_above_one',          label: 'R0 estimate crosses above 1.0',       escalateTo: 'elevated' },
  { id: 'doubling_48h',          label: 'Case count doubles within 48 hours', escalateTo: 'moderate' },
  { id: 'spike_mutation',        label: 'New ANDV strain with Gn/Gc spike mutations', escalateTo: 'moderate' },
  { id: 'no_known_exposure',     label: 'Case with NO close/prolonged exposure history', escalateTo: 'moderate' },
  { id: 'who_above_low',         label: 'WHO raises risk assessment above LOW',       escalateTo: 'moderate' },
  { id: 'cdc_above_level3',      label: 'CDC raises above Level 3',                   escalateTo: 'moderate' },
  { id: 'community_transmission', label: 'Community transmission outside index contacts', escalateTo: 'elevated' },
  { id: 'twenty_countries',      label: 'Cases in 20+ countries',                      escalateTo: 'low' },
] as const;
```

Each row in `threat_assessments` stores `triggers_watching` (subset of `TRIGGERS[].id` we're actively monitoring) and `triggers_tripped` (subset that has fired). The UI joins by id back to the config to render labels.

---

## Threat-level definitions

| Level | Probability | Token | Meaning |
|---|---|---|---|
| minimal | 0–2% | green | No credible pandemic risk. Contained cluster. |
| low | 2–10% | text-secondary | Very low risk. Monitoring but no concerning signals. |
| moderate | 10–25% | amber | Some concerning signals. Elevated monitoring. |
| elevated | 25–50% | orange | Multiple concerning signals. Significant uncertainty. |
| high | 50–75% | red | Likely to become a major public-health event. |
| critical | 75–100% | red on dark-red bg | Pandemic in progress or imminent. |

---

## Pipeline behavior

Each Cowork/runbook cycle:
1. Fetch all four Polymarket markets via gamma API.
2. Re-evaluate triggers against latest cases / events / facts.
3. Reassess pandemic_probability + threat_level + reasoning.
4. If `|new - last| > 0.01` OR a trigger trips/clears, INSERT a new row. Otherwise skip (don't spam the table).
5. Record `model` + `pipeline_session_id` for attribution.

---

## First-row seed

Insert the v1 baseline assessment from the source spec verbatim (3.5% / low / R0 0.7 / no mutations / SAR 0.02 / Polymarket 9.05%) — but as a `seed-threat.sql` file analogous to `seed-facts.sql`, registered in `supabase/config.toml` `sql_paths`.

---

## Out of scope (defer)

- Historical sparkline of pandemic_probability over time. Needs at least 5 rows in the table; ship the schema and UI now, sparkline lands in a follow-up after the pipeline has run a few cycles.
- Authenticated writes / RLS write policies — pipeline uses the `service_role` key off-platform, not browser writes. SELECT-only public RLS is sufficient for v1.
- `/threat` permalink page — banner + expand covers v1 needs.
