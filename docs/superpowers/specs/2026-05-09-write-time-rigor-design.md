# Write-time rigor for sig-4+ items — Design Spec

**Status:** Designed 2026-05-09. Pending implementation plan.
**Author:** Claude (cross-session brainstorm with the parallel pipeline-operator session)
**Trigger event:** May 9, 2026 — the dashboard wrote that 17 returning Americans would be sent to UNMC "for quarantine and monitoring." A CDC official clarified Saturday: "We are not quarantining anybody." The pipeline missed the clarification by a combination of write-time over-extrapolation and source-internal contradiction across channels.

---

## Goal

Reduce framing drift in agent-authored events and dossiers without bullet-proofing the runbook with narrow rules that fail on the next class of error. Build conventions that are general, structural, and enforceable on sight by the operator.

## Non-goals

- No schema migration. Pure markdown additions to `docs/runbooks/pipeline.md` plus tag-string conventions on `events.tags`.
- No new column on `events`. The existing `is_verified BOOLEAN` continues to govern URL-existence (per §4.5); the new tags govern attribution.
- No UI flow change in v1. The new tags are operator-on-sight-in-the-feed only.
- No machine-verification of verbatim quotes against source URLs (rejected — see §3).
- No marker convention for operator-confirmed dossier text (rejected — see §3).
- No blanket multi-source corroboration rule (rejected — see §3).

---

## Architecture

A single new section in `docs/runbooks/pipeline.md` titled **"Write-time rigor for sig-4+ items"**, slotted between `### 5. Write` and `## UI output coverage map`. The section is the canonical reference for the rules. Inline cross-links from existing sections (`### 3. Process & score`, `### 5. Write`) ensure the rules fire at the point of action rather than living only in a checklist the agent reads once and forgets.

The mechanism is conventions on tags and rules on agent behavior, all checkable on sight by an operator scanning the live feed. No part of the system requires schema changes, new columns, new UI components, or new background processes.

---

## The rules

### A. Verbatim quote requirement (sig-4+ items)

The agent's `events.summary` for any sig-4+ event must contain at least one direct quote from the source, in unicode quotes (`'…'`). The quote pins the source's actual language next to the agent's interpretation. SQL-escape concerns belong at the query-construction layer, not in the content convention.

**Example (clean state):**
```
Per CDC clarification (May 9): 'we are not quarantining anybody'.
```

**Example (contested state, demonstrates A + A.2 + B firing together):**
```
Summary:    CDC press release: 'CDC will coordinate the safe repatriation… American
            citizens are being repatriated to Offutt Air Force Base'. Per CDC verbal
            clarification (May 9): 'we are not quarantining anybody'.
Tags:       ['policy-ambiguity', 'paraphrased', 'cdc', 'mv-hondius', ...]
Significance: 5  -- policy importance unchanged
```

### A.2 Attribution tagging (metadata about the quote in A)

Every sig-4+ event also gets one attribution tag describing where the quote came from:

- `tags: ['primary-source', ...]` — quote is from the agency's own publication (press release, DON, statement, dashboard).
- `tags: ['paraphrased', ...]` — only a journalist's report exists; quote is framed as "[Outlet]: 'agency said X'" rather than the agency's direct voice.

Attribution metadata only. URL verification is separate (handled by §4.5). No `is_verified` field involved here.

### B. Opposing-search (binary policy claims)

For any binary policy claim — mandatory/voluntary, banned/allowed, confirmed/denied, will/may, declared/withdrawn — the agent must run **two searches**: the affirmative and the negation.

**"Substantive results"** means at least one Tier-1 or Tier-2 source making the opposing claim (per the existing `## Source credibility tiers` section). Social-media speculation does not count.

If the negation returns substantive results, **significance still reflects topic importance** (do not downgrade — that would hide a major policy story behind the SIGNAL tab). Instead the agent:
1. Includes both verbatim quotes side-by-side in the summary.
2. Tags `policy-ambiguity`.
3. Does not pick a side without operator input.

### C. Don't trust your own past writes

The agent treats all dossier text and prior event summaries as **agent-authored prior writes** — never as ground truth for interpretation. On every cycle, re-verify framing against current sources. Do not preserve framing solely because the DB already contains it. If the source language has shifted, propose an UPDATE softening or correcting the prior dossier/summary.

This is the operator-revise-loop in agent-actionable form. There is **no marker convention** for "operator-confirmed text" in v1 — the rule applies uniformly to all DB content the agent re-encounters.

---

## Cross-links from inline steps

The rules above must fire at the point of action, not only in a standalone reference section.

- **§3 Process & score** gains one line: *"For binary policy claims (mandatory/voluntary, banned/allowed, confirmed/denied), see §Write-time rigor B (opposing-search)."*
- **§5 Write** gains, at the top: *"Operator may revise any event after publish; treat past writes as drafts when re-encountering them on subsequent cycles, not ground truth (see §Write-time rigor C)."*
- **§5 Write** gains, in the per-item write block: *"For sig-4+ events, see §Write-time rigor A (verbatim quote required) and A.2 (primary-source vs paraphrased tagging)."*

---

## Explicit non-goals (and why)

Future sessions reading the runbook will be tempted to extend these rules in directions we have already considered and rejected. Documenting the no-go's prevents over-extension.

### Not in scope: blanket multi-source corroboration

**Rule we considered:** require ≥2 independent sources before any sig-4+ INSERT.
**Why rejected:** wire services routinely echo the same press release with the same framing. Two outlets reporting "Americans will be evacuated for quarantine" is one press release reflected twice — not independent corroboration. The rule adds latency on Tier-1 primary statements (WHO DON, ECDC TAB, CDC HAN) which ARE the source, not candidates for corroboration. Rules A and B handle the failure mode without this cost.

### Not in scope: UI signal for `paraphrased` tag (v1)

The tag is operator-on-sight-in-the-feed only. No EventCard tone change, no inline footnote, no integration with the SIGNAL tab. If drift turns out to need stronger visual surfacing, that's a separate frontend sub-project. Anyone reading the runbook patch and reaching for `components/feed/EventCard.tsx` is over-extending.

### Not in scope: marker convention for operator-confirmed text

**Rule we considered:** prefix operator-corrected dossier text with `[OP]` (or use a separate `cases.dossier_confirmed` field) so the agent can distinguish operator authority from its own past writes.
**Why rejected:** adds a convention the operator must remember; partial adoption is worse than uniform skepticism. Rule C ("agent treats all prior DB writes as agent-authored, re-verify on every cycle") is more honest about what's enforceable today. Marker convention is a v2 candidate if Rule C alone proves insufficient.

### Not in scope: machine-verification of verbatim quotes against source URLs

**Tempting extension:** fetch the source URL, parse the page, confirm the quoted string appears on it.
**Why rejected:** false confidence on the cases where it works is more dangerous than uniform skepticism. The checker succeeds on plain HTML and silently fails on paywalls, dynamic content, PDFs, image-only documents, embedded video transcripts. The verbatim-quote rule's value is the side-by-side framing for the operator's eye, not a machine-checkable invariant.

### Not in scope: schema changes

No new columns, no new enum values, no migrations. The whole patch is markdown additions to `pipeline.md` and tag-string conventions on `events.tags`. Anyone reaching for `supabase/migrations/` is over-extending.

---

## Residual drift, framed honestly

Three rules + a non-scope list will reduce framing drift. They will not eliminate it.

The CDC case that prompted this work had **two layers**:

The first was an **over-extrapolation at write time** — the press release said "available for evaluation/monitoring" and the agent collapsed that into stronger "for quarantine and monitoring" framing. Rule A (verbatim quote required) is designed to make exactly that collapse structurally hard. With the rule in place, the agent's summary would have had to pin the source's actual neutral language next to whatever interpretation it added — and the over-extrapolation would have been visible to the operator on sight.

The second was **source-internal contradiction across channels** — the verbal clarification reversed the mandatory tone hours after the press release. No write-time rule the pipeline could apply prevents that. At the moment of the agent's write, the press release was the only available source and reading it neutrally was the most defensible interpretation; the contradiction came from outside the pipeline's view.

The operator feedback loop is the only cure for the second layer. Sessions that read this runbook should expect to revise their own past writes regularly — that's the system working as intended, not the system breaking.

---

## Acceptance criteria

Implementation is complete when, after the runbook patch lands and a fresh cycle runs:

- The runbook contains a `## Write-time rigor for sig-4+ items` section between `### 5. Write` and `## UI output coverage map`.
- `### 3. Process & score` carries a one-line cross-link to §B.
- `### 5. Write` carries a one-line operator-revise-loop note at the top and a one-line cross-link to §A and A.2 in the per-item write block.
- A spot-check of the next 10 sig-4+ events written in production:
  - Each summary contains at least one unicode-quoted string from the source.
  - Each event has either `primary-source` or `paraphrased` (not both, not neither).
  - Any binary policy claim with disagreement across Tier-1/2 sources carries `policy-ambiguity` and shows both quotes side-by-side.
- A spot-check of the next case dossier UPDATE the agent issues:
  - The agent has cross-referenced current sources, not preserved older framing solely because the DB contained it.

These are operator-on-sight checks. No new tests, no new monitoring, no new tooling.

---

## Decisions log

| Decision | Choice | Why |
|---|---|---|
| Where the rules live | One new section in `pipeline.md` + cross-links from §3 and §5 | Standalone-only is checklist theater; inline-only is hard to maintain |
| How to tag attribution | `primary-source` / `paraphrased` strings on `events.tags` | Existing `TEXT[]` schema already supports it; no migration |
| Whether `is_verified` participates in attribution | No | `is_verified` covers URL existence (§4.5); attribution is a different concern |
| Significance handling for contested binary claims | Keep at topic importance; tag `policy-ambiguity`; show both quotes | Capping at sig-2 hides major policy stories behind the SIGNAL tab |
| Distinguishing operator-corrected text from agent-authored prior writes | No (v1) | Marker convention adds operator burden; uniform skepticism is more enforceable |
| Quote mechanism for verbatim text | Unicode `'…'` quotes only | SQL-escape concerns belong at the query layer, not the content convention |
| Multi-source corroboration as blanket rule | Rejected | Wire services echo same press release; doesn't address the failure class |
| Machine-verification of quotes against source URLs | Rejected | Partial coverage produces false confidence on the formats it can't read |

---

## Implementation framing for writing-plans

This is a small, contained patch:

- **One file modified:** `docs/runbooks/pipeline.md`
- **One section added** (the canonical reference)
- **Three inline cross-links** added (one in §3, two in §5)
- **No schema changes, no UI changes, no test changes**

Suggested task decomposition for the implementation plan:

1. Add the `## Write-time rigor for sig-4+ items` section between `### 5. Write` and `## UI output coverage map`, containing rules A, A.2, B, C in the form documented above, with both example quote blocks.
2. Add the `## Explicit non-goals` subsection to that same new section.
3. Add the `## Residual drift, framed honestly` closer to that same new section.
4. Insert the cross-link line in `### 3. Process & score`.
5. Insert the operator-revise-loop note and the cross-link line in `### 5. Write`.
6. Commit and push.

No verification step needed beyond `git diff` review — there is no code to typecheck, no tests to run, no DB to migrate.

When picking this up: invoke `superpowers:writing-plans` to convert this spec into a task-by-task plan. Each step above maps to one Edit tool call.
