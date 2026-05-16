# Pathwatch

Real-time public-health intelligence dashboard for active outbreak clusters.

**Live: [hantavirustracer.com](https://hantavirustracer.com)** ([mirror](https://pathwatch-phi.vercel.app))

V1 covers the 2026 MV Hondius hantavirus cluster (Andes orthohantavirus / ANDV)
— the multi-country cruise-ship outbreak that began on the Dutch expedition
vessel MV Hondius in April 2026.

## What it does

The dashboard tracks the outbreak across five surfaces, refreshed in real time
from a curated database of WHO Disease Outbreak News, ECDC surveillance updates,
CDC briefings, national health-ministry releases, and Cred-Tier-1-and-2 news
reporting:

- **Situation brief** — daily prose snapshot of what's changed, written for a
  general public-health-literate reader (no jargon).
- **World map** — country-by-country case, death, and monitoring counts on a
  MapLibre + deck.gl basemap; click any case to see its travel timeline.
- **Case dossiers** — anonymised per-patient pages with hospital, clinical
  trajectory, contact-tracing history, and inline source citations.
- **Threat assessment** — pandemic-probability estimate with explicit reasoning,
  Polymarket comparison, and a triggers watch-list (R0, mutation, doubling
  time, community transmission, etc.).
- **Intelligence feed** — horizontal ticker of significance-ranked events from
  the past few cycles, each with a verified primary source.

## Editorial standards

- Every dossier addition cites its sources inline.
- Demographics are reported as ranges only (e.g. "60–69") — never exact ages.
- Anonymised cases retain anonymisation even when reporting reveals identities.
- Case classifications follow WHO conventions (confirmed / probable / suspected
  / contact / returnee). Suspected and inconclusive cases are tracked but do
  not colour the country map orange or red.

## Stack

- Next.js 14 App Router (TypeScript)
- Supabase (Postgres + Realtime + Row-Level Security)
- MapLibre + deck.gl
- Tailwind CSS
- Hosted on Vercel

## License

This repository is published for transparency. All rights are reserved.
See [LICENSE](LICENSE) for the full terms.

In short: you are welcome to **read** the code here. You are **not** licensed
to use, fork, clone, mirror, redeploy, or build upon it without prior written
permission from the author.

For permission inquiries, contact the author via the email on the live site.

## Status

Live in production. New outbreak clusters will be added in future releases.

— CrashOverride LLC
