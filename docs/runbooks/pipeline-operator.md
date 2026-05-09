# Pathwatch Pipeline — Operator Guide

**Audience:** You — the human running the pipeline Claude session.

This guide is the companion to [`pipeline.md`](pipeline.md). That doc is for the **agent** (it tells Claude what to do each cycle). This doc is for **you** — how to set up a session, kick it off, monitor it, and shut it down. Read this first when you sit down to run the pipeline.

---

## What "the pipeline" actually is

There is no cron job, no headless agent, no scheduler. The pipeline is **a Claude conversation** running in your Cowork environment that:

1. Reads `docs/runbooks/pipeline.md` at session start
2. Has the Pathwatch Supabase service-role key in its environment
3. Has Chrome MCP for X/Twitter scraping
4. Loops scrape → dedupe → fact-check → write into Supabase, on a cadence you tell it to maintain

Each loop is called a **cycle**. The dashboard at https://pathwatch-phi.vercel.app reads whatever the pipeline writes — Realtime subscriptions push changes to anyone with the page open.

---

## Prerequisites (one-time setup, already done if you're reading this)

| Thing | Where it lives | Why |
|---|---|---|
| Cowork environment | Mac mini in your office | Where the pipeline Claude session runs |
| Supabase service-role key | Supabase dashboard → Settings → API Keys → "Secret key" | Bypasses RLS; required for writes |
| Chrome with persistent profile | Logged into X/Twitter, BlueSky, Reddit | Lets the agent scrape without auth dialogs interrupting |
| Vercel `NEXT_PUBLIC_*` env vars | Already in Vercel project settings | Production already pulls these on deploy |

Verify the secret key is set in your shell session:

```bash
echo -n "$SUPABASE_SERVICE_ROLE_KEY" | wc -c   # should print >50
```

Never echo the value itself. Never paste it into chat.

---

## Starting a session

Open a new Claude Code session in `/Users/claude/Projects/project_contagion`. Paste this opening prompt (or your own variation — the key is the runbook reference + the cadence):

```
You are now operating the Pathwatch pipeline.

Read these in order before doing anything else:
1. docs/runbooks/pipeline.md  — your spec
2. README.md                    — context

Stay in active mode (cycle every 15–30 min). Surge to 5–10 min on:
- new country reports a case
- WHO press briefing or new DON
- death-count change
- confirmed mutation
- border closure / major travel advisory

Run a first cycle now.
```

That's the whole startup. The agent reads its own runbook and starts looping.

**Confirmation that the session started successfully:**

```bash
# Run from this repo, in another terminal:
supabase db query "SELECT created_at, source_type, results_found, events_created, duplicates_skipped FROM scrape_log ORDER BY created_at DESC LIMIT 5;" --linked
```

If a fresh row appeared in the last few minutes, the session is live.

---

## What the agent does, in plain English

Each cycle (~10–15 minutes wall-clock):

1. **Scrape** all configured sources for new hantavirus / MV Hondius mentions. Persists raw text to `events.raw_content`.
2. **Dedupe** by URL hash (DB unique index handles exact dupes). For semantic dupes within 48h, it inserts a child event with `duplicate_of` set to the parent — so corroboration counting still works.
3. **Process & score**: classify category (`case_report`, `policy`, etc.), extract case/death counts, geocode locations, score significance 1–5.
4. **Fact-check**: if it's a new claim, decide whether it goes into the `facts` table as `confirmed`, `corroborated`, or `unverified` based on source tier.
5. **Write**: INSERT events, UPDATE/UPSERT cases + case_locations + country_stats, INSERT scrape_log row.
6. **Threat assessment**: every cycle, fetch Polymarket odds, walk the trigger list, recompose the threat picture. INSERT a new `threat_assessments` row only if something materially changed.
7. **Snapshot aggregation**: every 4th cycle (or immediately on a sig-5 event), aggregate fresh totals and INSERT a new `snapshots` row.

Every action lands in `scrape_log` (per-source) or in the table being mutated (everywhere else) — there is no hidden state.

---

## Monitoring — quick health checks

These are all read-only; run them anytime in another terminal.

**Last 10 cycles:**
```bash
supabase db query "SELECT created_at, source_type, results_found, events_created, duplicates_skipped, error FROM scrape_log ORDER BY created_at DESC LIMIT 10;" --linked
```

**Cycle frequency over the last 24h** (target: 15–30 min in active mode):
```bash
supabase db query "
  WITH t AS (
    SELECT created_at,
           lag(created_at) OVER (ORDER BY created_at) AS prev
    FROM scrape_log
    WHERE created_at > now() - interval '24 hours'
  )
  SELECT COUNT(*) AS cycles, ROUND(AVG(EXTRACT(EPOCH FROM (created_at - prev)) / 60)::numeric, 1) AS avg_minutes_between
  FROM t WHERE prev IS NOT NULL;
" --linked
```

**Top source types and their error rate:**
```bash
supabase db query "
  SELECT source_type,
         count(*) AS runs,
         sum(events_created) AS events_added,
         sum(duplicates_skipped) AS dups,
         count(*) FILTER (WHERE error IS NOT NULL) AS errors
  FROM scrape_log
  WHERE created_at > now() - interval '24 hours'
  GROUP BY source_type
  ORDER BY runs DESC;
" --linked
```

**Newest 5 events** (sanity check the pipeline is producing useful output, not noise):
```bash
supabase db query "
  SELECT created_at, significance, category, source_type, country_code, title
  FROM events
  WHERE duplicate_of IS NULL
  ORDER BY created_at DESC
  LIMIT 5;
" --linked
```

**Latest threat assessment + last few snapshots:**
```bash
supabase db query "SELECT created_at, threat_level, pandemic_probability, polymarket_pandemic_odds FROM threat_assessments ORDER BY created_at DESC LIMIT 3;" --linked
supabase db query "SELECT created_at, total_cases, total_deaths, countries_affected, risk_level FROM snapshots ORDER BY created_at DESC LIMIT 3;" --linked
```

**Open the dashboard** at https://pathwatch-phi.vercel.app — Realtime should reflect anything written in the last few minutes.

---

## Common course-corrections

When you need to change the agent's behavior mid-session, just talk to it. Examples:

| Situation | Tell it |
|---|---|
| "Surge — there's a new WHO DON" | `Surge cycle to 5–10 min for the next 2h. Prioritize WHO + Tier-1 official sources.` |
| "Slow down — nothing happening" | `Drop to off-hours cadence (every 60 min). Skip Reddit/X for now, focus on WHO/CDC/ECDC.` |
| "Stop touching X — it's noisy" | `Pause X scraping for the rest of the session. Continue everything else.` |
| "I don't trust this fact" | `Mark fact <title> as 'disputed'. Find what new evidence is needed to upgrade or retract.` |
| "Reset the cycle clock" | `Run one cycle now, then resume normal cadence from this moment.` |
| "Backfill from a specific source" | `Scrape ECDC for the last 7 days and import any events I'm missing.` |

The agent is following the runbook, not running on rails. It will negotiate with you on edge cases (e.g. "I see two Tier-1 sources contradicting on the death count — should I write them both or wait?").

---

## When something goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| `scrape_log` hasn't grown in >60 min | Session crashed, sleeping, or rate-limited everywhere | Check the Cowork window. Restart with the same opening prompt. |
| All cycles error on X/Twitter | Chrome session expired or rate-limited | Re-auth Chrome on the Mac mini. Tell agent to skip X for now. |
| Supabase write errors with `42501` | Service-role key not in env, or key was rotated | Re-export `SUPABASE_SERVICE_ROLE_KEY` in the session shell. |
| Duplicate-key errors `23505` on events | Working as intended — that's the URL-hash unique index doing dedup. | Ignore. The agent should be catching these and recording `duplicates_skipped`. |
| Polymarket odds all NULL | Markets moved or were renamed | See `pipeline.md` "Threat assessment cycle § 1" — slugs are listed there. Verify each via `curl https://gamma-api.polymarket.com/events?slug=<slug>`. |
| Dashboard shows stale data | Vercel data cache (rare — `unstable_noStore()` is in place) OR the agent stopped writing | Check `scrape_log`. If recent → it's a UI cache; hard-refresh. If stale → agent issue. |
| The agent contradicts the pipeline.md spec | Drift over a long session, or your custom course-correction wandered | Quote the relevant section back at it: `Re-read pipeline.md § X.` |

---

## Tuning the agent's behavior

**Tighter source list**, e.g. if you want to ignore social media for a few hours:
> Pause Reddit, X, and BlueSky. Active sources for the next 4h: WHO, CDC, ECDC, Africa CDC, Google News, Wikipedia.

**Lower confidence threshold for a specific topic** (use carefully):
> For any claim about ANDV mutations or sequencing, require Tier-1 corroboration before storing as a fact. Log everything else as events only.

**Targeted backfill** if you suspect coverage gaps:
> Walk the WHO DON archive for everything tagged 'hantavirus' since 2026-04-01. Compare against `events` and insert anything missing.

**Pause writing** but keep monitoring (useful when you suspect the agent is degrading data):
> Read-only mode: scrape and analyze, but do not INSERT/UPDATE anything. Surface what you would have written so I can review.

---

## Stopping a session

Tell the agent:

> Run one final cycle, then stop. Confirm `scrape_log` shows the last cycle's row. Print the most recent `events.created_at` so the next session knows where to resume.

That maps onto the "Session-end checklist" in `pipeline.md`. After it confirms, just close the Cowork window.

If the session crashed or hung instead of being stopped cleanly, no recovery is needed — every write is independent. The next session resumes from the latest `scrape_log` timestamp on its own.

---

## Picking up the next session

Open a new Cowork session and use the same opening prompt as in [Starting a session](#starting-a-session). The agent will:

1. Re-read `pipeline.md`
2. Query `scrape_log` for the most recent run to know how far back to scan
3. Catch up by scraping anything new since that timestamp
4. Resume normal cadence

You don't need to brief it on the outbreak state — the data in Supabase is the source of truth.

---

## Where to look when you have a question

| Question | Where the answer is |
|---|---|
| "What is the agent supposed to do this cycle?" | `docs/runbooks/pipeline.md` |
| "What did the agent actually do?" | `scrape_log` table |
| "What's currently visible to dashboard users?" | https://pathwatch-phi.vercel.app + the relevant Supabase table |
| "Is the threat picture right?" | `threat_assessments` ORDER BY created_at DESC LIMIT 1 + the trigger list in `lib/threat-triggers.ts` |
| "Did this fact get sourced properly?" | `facts` table — every row carries `sources[]` + `source_types[]` + `verification_status` |
| "Has any case been mis-merged?" | `cases` ON `case_code` is unique; `case_locations.case_id` foreign-keys back |

The whole project is built so the operator can verify any claim by querying the database. If you can't trace a number on the dashboard back to a row, that's a bug — file it.

---

## Quick reference card

```
Start:    Open Cowork → paste opening prompt → expect first scrape_log row in ~5 min
Health:   supabase db query "SELECT created_at, source_type FROM scrape_log ORDER BY created_at DESC LIMIT 5;" --linked
Surge:    Tell agent: "Surge cycle to 5–10 min for the next 2h"
Pause:    Tell agent: "Read-only mode for the next hour"
Stop:     Tell agent: "Run one final cycle, then stop"
Resume:   Open new session, paste opening prompt, agent catches up from latest scrape_log row
Verify:   https://pathwatch-phi.vercel.app — should reflect writes within seconds
```