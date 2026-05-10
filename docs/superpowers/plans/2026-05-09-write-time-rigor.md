# Write-time Rigor for sig-4+ Pipeline Items — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Patch `docs/runbooks/pipeline.md` with rules and cross-links that reduce framing drift on sig-4+ events. Plus pin `is_verified` semantics in §4.5.

**Architecture:** Pure documentation change. One file modified. Five Edit operations across the file: one new top-level section + three inline cross-link insertions + one tightening patch on §4.5. No code, no schema, no UI, no tests.

**Tech Stack:** Markdown.

**Reference spec:** `docs/superpowers/specs/2026-05-09-write-time-rigor-design.md`

---

## Pre-flight

- Working directory: `/Users/claude/Projects/project_contagion`
- Single file affected: `docs/runbooks/pipeline.md`
- Existing structure as of this plan: `### 5. Write` is followed by `## UI output coverage map`. The new section slots between them.
- Existing structure: `### 4. Fact-check` is followed by `### 4.5. URL verification (mandatory before any write)`, then `### 5. Write`.
- No npm scripts, typecheck, or tests run for this change. Verification is `git diff` review.

---

## File structure

| Path | Status | Purpose |
|---|---|---|
| `docs/runbooks/pipeline.md` | Modify | Add `## Write-time rigor for sig-4+ items` section + 3 inline cross-links + 1 patch on §4.5 |

---

## Task 1: Add the `## Write-time rigor for sig-4+ items` section

**Files:**
- Modify: `docs/runbooks/pipeline.md` — insert new section between `### 5. Write` block and `## UI output coverage map`

- [ ] **Step 1: Locate the insertion point**

Run: `grep -n "^## UI output coverage map" docs/runbooks/pipeline.md`
Expected: a line number (the new section goes immediately before this).

- [ ] **Step 2: Insert the new section**

Use Edit to add the section. The `old_string` should be the line `## UI output coverage map` (with the leading blank line context) and the `new_string` should be the full new section followed by `## UI output coverage map`.

```markdown
## Write-time rigor for sig-4+ items

These rules apply when an event's `significance` is 4 or 5. They reduce framing drift; they do not eliminate it (see "Residual drift" below).

### A. Verbatim quote requirement

The agent's `events.summary` for any sig-4+ event must contain at least one direct quote from the source, in unicode quotes (`'…'`). The quote pins the source's actual language next to the agent's interpretation. SQL-escape concerns belong at the query-construction layer, not in the content convention.

**Example (clean state):**
```
Per CDC clarification (May 9): 'we are not quarantining anybody'.
```

**Example (contested state, demonstrates A + A.2 + B firing together):**
```
Summary:    CDC press release: 'CDC will coordinate the safe repatriation… American
            citizens are being repatriated to Offutt Air Force Base'. Per ABC News
            reporting a CDC clarification (May 9): 'we are not quarantining anybody'.
Tags:       ['policy-ambiguity', 'paraphrased', 'cdc', 'mv-hondius', ...]
Significance: 5  -- policy importance unchanged
```

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

```

(Use the actual triple-backtick markdown blocks; the literal triple-backticks above are inside the new section text.)

- [ ] **Step 3: Verify with grep**

Run: `grep -n "## Write-time rigor for sig-4+ items" docs/runbooks/pipeline.md`
Expected: one match.

Run: `grep -nE "^### A\." docs/runbooks/pipeline.md`
Expected: matches for `### A. Verbatim`, `### A.2 Attribution`, `### B. Opposing`, `### C. Don't trust`.

- [ ] **Step 4: Don't commit yet** (committing once at the end after all five edits — Task 5)

---

## Task 2: Add cross-link to `### 3. Process & score`

**Files:**
- Modify: `docs/runbooks/pipeline.md` — add one line at the end of the `### 3. Process & score` section

- [ ] **Step 1: Locate the insertion point**

Run: `grep -n "### 4. Fact-check" docs/runbooks/pipeline.md`
Expected: a line number. The new line goes immediately before this header (i.e., as the last line of §3 before the blank line preceding §4).

- [ ] **Step 2: Insert the cross-link**

Use Edit. `old_string` should be the last bullet of §3 (the strain/context/topic tagging line) followed by the blank line before `### 4. Fact-check`. The `new_string` adds one line:

The current last line of §3 is approximately:
```
- **Tag** with strain (`andes-virus`), context (`mv-hondius`), and topic (`transmission`, `cfr`, `human-to-human`, etc.)
```

Append a new line after it:
```
- For binary policy claims (mandatory/voluntary, banned/allowed, confirmed/denied, will/may, declared/withdrawn), see `## Write-time rigor for sig-4+ items` §B (opposing-search).
```

- [ ] **Step 3: Verify**

Run: `grep -A2 "Tag.*strain" docs/runbooks/pipeline.md`
Expected: the tag line followed by the new cross-link line.

---

## Task 3: Add operator-revise note + cross-link in `### 5. Write`

**Files:**
- Modify: `docs/runbooks/pipeline.md` — add operator-revise note at the top of §5 and a per-item cross-link inside the write block

- [ ] **Step 1: Locate §5**

Run: `grep -n "^### 5. Write" docs/runbooks/pipeline.md`
Expected: a line number.

- [ ] **Step 2: Insert operator-revise note at the top**

Use Edit to add a paragraph immediately after the `### 5. Write` header and before the existing "For each processed item:" line.

`old_string` is approximately:
```
### 5. Write

For each processed item:
```

`new_string`:
```
### 5. Write

> **Operator-revise loop:** any event the agent writes is a draft. The operator may revise it after publish. When the agent re-encounters its own past writes on subsequent cycles (reading `events`, `cases.dossier`, prior `snapshots`), it does **not** treat them as ground truth for interpretation — see `## Write-time rigor for sig-4+ items` §C.

For each processed item:
```

- [ ] **Step 3: Insert per-item cross-link inside the write block**

The write block currently ends with the line:
```
INSERT scrape_log row (source, results_found, events_created, duplicates_skipped, error?, duration_ms)
```

Use Edit to add a line immediately after the closing triple-backtick of that block (and before "After writing, every 4th cycle…").

`old_string` is approximately the closing `\`\`\`` of the per-item block + the blank line + "After writing".

`new_string` keeps that structure but inserts a one-line note:
```
\`\`\`

For sig-4+ events, see `## Write-time rigor for sig-4+ items` §A (verbatim quote required) and §A.2 (`primary-source` vs `paraphrased` tagging).

After writing, **every 4th cycle** (or immediately on a sig-5 event):
```

- [ ] **Step 4: Verify**

Run: `grep -n "Operator-revise loop" docs/runbooks/pipeline.md`
Expected: one match in §5.

Run: `grep -n "see .## Write-time rigor" docs/runbooks/pipeline.md`
Expected: at least 2 matches (one in §3, one in §5; possibly more if §A.2 reference counts).

---

## Task 4: Patch `### 4.5. URL verification` with `is_verified` semantics

**Files:**
- Modify: `docs/runbooks/pipeline.md` — add one line to §4.5 pinning what the `is_verified` boolean means

- [ ] **Step 1: Locate §4.5**

Run: `grep -n "^### 4.5. URL verification" docs/runbooks/pipeline.md`
Expected: a line number.

- [ ] **Step 2: Insert the semantics line**

The §4.5 section currently ends with a paragraph about why the rule exists ("The reason: past pipeline cycles accumulated dead links…"). Use Edit to add a new line immediately before that closing paragraph (i.e., after the bullet list and before "The reason:").

The current bullet list in §4.5 ends approximately:
```
- If the search snippet is interesting but no resolvable URL exists, log a `signal`-tagged event with `source_url = NULL` and a note in the summary that the URL was unverified — but only for content that's clearly identifiable from the snippet alone (e.g. an official press release where the agency name is the source).
```

After that bullet, before the next paragraph about the unique index, insert:
```
**`is_verified` semantics:** set `is_verified = true` for events written from a resolved URL (WebFetch returned 2xx and content matches the summary). Set `is_verified = false` for events written from search snippets without a resolvable URL (rare — see exception above). Do not set `is_verified = true` based on tier alone; the field tracks URL existence, not source authority.
```

- [ ] **Step 3: Verify**

Run: `grep -n "is_verified semantics" docs/runbooks/pipeline.md`
Expected: one match.

---

## Task 5: Review the full diff, commit, push

**Files:** none modified in this task; this is the verification + commit step.

- [ ] **Step 1: Inspect the full diff**

Run: `git diff docs/runbooks/pipeline.md`

Skim the diff and confirm:
- One new top-level `## Write-time rigor for sig-4+ items` section with subsections A, A.2, B, C, "Explicit non-goals", "Residual drift, framed honestly".
- One new line at the end of `### 3. Process & score` cross-linking to §B.
- One new paragraph at the top of `### 5. Write` with the operator-revise loop note.
- One new line in the §5 write block cross-linking to §A and §A.2.
- One new paragraph in `### 4.5. URL verification` pinning `is_verified` semantics.
- No unrelated edits.

- [ ] **Step 2: Confirm no broken anchors**

Run: `grep -E "see .## Write-time rigor for sig-4\+ items." docs/runbooks/pipeline.md`
Expected: at least 3 matches (in §3, §5, and possibly §5 again for §A.2 reference).

The cross-links use `## Write-time rigor for sig-4+ items` exactly — this matches the section header verbatim, so any markdown renderer that auto-anchors headers will resolve the link.

- [ ] **Step 3: Commit**

```bash
git add docs/runbooks/pipeline.md
git commit -m "$(cat <<'EOF'
Pipeline runbook: write-time rigor rules for sig-4+ items

Adds a new section 'Write-time rigor for sig-4+ items' covering:
- A: verbatim quote required from the source (unicode quotes)
- A.2: primary-source / paraphrased attribution tagging with
  weakest-link tie-breaker
- B: opposing-search for binary policy claims; preserves
  significance at topic importance and tags policy-ambiguity
  if contested
- C: agent treats all prior DB writes as agent-authored drafts
  and re-verifies framing against current sources every cycle

Plus inline cross-links from sections 3 and 5 so the rules fire
at the point of action, a one-line tightening of section 4.5
pinning is_verified semantics, and an explicit non-goals subsection
documenting four extensions that are deliberately out of scope.

Closes with an honest two-layer post-mortem of the May 9 CDC
quarantine framing miss showing what the rules will catch
(write-time over-extrapolation) and what they cannot
(source-internal contradiction across channels — operator loop
is the only cure).

Spec: docs/superpowers/specs/2026-05-09-write-time-rigor-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Push**

```bash
git push origin main
```

Expected: push succeeds, commit hash printed.

- [ ] **Step 5: No deploy needed**

This change is documentation only. No Vercel build, no Supabase migration, no UI refresh required.

---

## Self-review checklist

Run through these against the spec at `docs/superpowers/specs/2026-05-09-write-time-rigor-design.md`:

| Spec requirement | Plan task |
|---|---|
| Rules A, A.2, B, C in `pipeline.md` | Task 1 |
| §3 cross-link to §B | Task 2 |
| §5 operator-revise note + per-item cross-link to §A and §A.2 | Task 3 |
| §4.5 patch with `is_verified` semantics one-liner | Task 4 |
| Explicit non-goals subsection (4 items) | Task 1 |
| "Residual drift, framed honestly" closer | Task 1 |
| Two-layer CDC case post-mortem in residual-drift closer | Task 1 |
| `paraphrased` weakest-link tie-breaker | Task 1 (in §A.2) |
| `substantive` defined via Tier-1/2 reference | Task 1 (in §B) |
| Both example quote blocks (clean + contested) | Task 1 (in §A) |

No tasks missing.

No code changes, no schema changes, no UI changes — by spec design.

No tests to write — by spec design (the verification model is operator-on-sight in the live feed, not machine-checkable).
