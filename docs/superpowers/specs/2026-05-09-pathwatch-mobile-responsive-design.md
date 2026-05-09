# Pathwatch — Mobile-Responsive Dashboard

**Date:** 2026-05-09
**Branch:** `feat/mobile-responsive`
**Vercel preview:** every push to this branch creates an isolated preview URL; production at https://pathwatch-phi.vercel.app stays untouched until merge.
**Reference:** worldmonitor.app mobile patterns (collapsible map, stacked panels, landscape ≈ desktop).

---

## Goal

Make the Pathwatch dashboard a real phone-first experience for the "track this myself, not rely on media" use case. Match the design quality of the rest of the project — not a desktop layout that happens to work on a phone.

---

## What's broken on mobile today

1. **Map collapses to 0px** below `lg`. The right column's map wrapper uses `flex-1` of a parent whose stacked-mode height is content-driven, so MapLibre sees a zero-height container.
2. **TopBar overflows** — brand + OPS CONSOLE + LIVE + SCOPE GLOBAL + UTC + RISK MODERATE in a single h-8 row wraps ugly on phone widths.
3. **Threat banner crowds** — three inline sections (probability + market delta + expand) packed into a 390px viewport.
4. **Dossier drawer covers the screen** — `max-w-[420px]` overlay positioned `right-0` inside a 390px-wide pane is the entire screen with no map context behind it.
5. **Posture Matrix table overflows** — multi-column table doesn't fit narrow widths.
6. **Trace popup wider than viewport** — 360px popup on a 360px phone screen edge-to-edge.
7. **Monitoring rows wrap awkwardly** — case label + role + country + days chip on one line breaks on narrow widths.

---

## Architecture

**Single source of truth: Tailwind responsive classes, breakpoint at `lg` (1024px).** No JavaScript media queries (avoid hydration flicker).

| Below `lg` | At `lg` and above |
|---|---|
| Single-column stack via `<MobileLayout>` | Current 35fr / 65fr grid via existing layout in `DashboardClient` |
| Map collapsible toggle (`▼ Hide Map / ▶ Show Map`) | Toggle hidden — map fills its column |
| Dossier = bottom sheet (Vaul, drag-to-resize) | Dossier = right-anchored drawer (current) |
| Threat banner condensed | Threat banner wide strip (current) |
| TopBar minimal (brand + LIVE only) | Full TopBar (current) |
| Filter chips wrap | Filter chips wrap |

`DashboardClient` branches at the top level: at `lg+` render the existing grid; below `lg` render `<MobileLayout>`. Both consume the same props + state, so realtime + URL state behave identically.

**Section order on mobile portrait, top to bottom:**

1. TopBar (compact: brand + LIVE)
2. ThreatBanner (condensed, sticky)
3. MapWithToggle (collapsible, default expanded at ~55vh)
4. SituationBrief
5. KpiGrid (2-up always)
6. PostureMatrix (vertical card list, not a table)
7. Watchlist
8. MonitoringCohort
9. VirusProfile (compact card with all 12 tiles, expand reveals full list)
10. EventFeed (with the 6-tab strip wrapping to multiple lines)

When a case is selected on mobile (`?case=…`), the bottom sheet slides up over the layout. Map stays interactive in the upper portion when the sheet is at peek/half snap points.

---

## Components

### New

**`components/ops/MobileLayout.tsx`**
- Renders the stacked single-column layout below `lg`.
- Hidden via `lg:hidden` on its outer wrapper.
- Receives the same props the desktop grid does (snapshot, events, countries, cases, caseLocations, threat, facts, monitoringCases, activeCases, prevSnapshot, etc.).
- Hosts the `<CaseDossierSheet>` controller (the sheet is mounted unconditionally; opens when `caseCode` is set, closes when not).

**`components/case/CaseDossierSheet.tsx`**
- Wraps `<CaseDossier>` inside a Vaul `<Drawer>` with `direction="bottom"`.
- Snap points: `[0.3, 0.55, 0.85]` (peek / half / full of viewport height).
- Default snap on open: `0.55`.
- Drag handle bar at top; `×` close button in the sheet header.
- Outside-tap and swipe-down both dismiss (clear `?case=` URL param).

**`components/ops/MapWithToggle.tsx`**
- Wraps `<MapPane>`.
- Renders a `▼ Hide Map / ▶ Show Map` button at the top.
- State: `isOpen` — when closed, replaces the map with a 32px-tall strip showing case-count summary.
- Default `isOpen = true`.
- Persists state to `localStorage` under `pathwatch:mobile-map-open` so it survives reloads.
- Only used inside `<MobileLayout>` — desktop never imports it.

**`components/ops/PostureMatrixCards.tsx`**
- Mobile-only vertical card list of country posture rows.
- Each card: country flag + name on one line; cases / deaths / status pill on the second line.
- Replaces the table render below `lg`. The desktop `<PostureMatrix>` keeps the table.
- `<PostureMatrix>` becomes a thin wrapper that renders `<PostureMatrixCards>` below `lg` and the existing table at `lg+` via `lg:hidden` / `hidden lg:block`.

### Modified

- **`app/DashboardClient.tsx`** — wrap the desktop grid in `<div class="hidden lg:grid lg:grid-cols-[35fr_65fr] …">` and add `<MobileLayout class="lg:hidden …" {...props} />` alongside it.
- **`components/ops/TopBar.tsx`** — UTC, SCOPE GLOBAL, and the RISK chip wrapped in `<span class="hidden lg:flex">`. The brand + LIVE always show.
- **`components/threat/ThreatBanner.tsx`** — tighten gap from `gap-6` to `gap-3` and shrink label/value sizes a notch below `lg`.
- **`components/map/MapPanel.tsx`** — popup `maxWidth` becomes `min(360px, 92vw)` so it never exceeds viewport edge.
- **`app/globals.css`** — small additions for the bottom-sheet drag handle and Vaul base classes.

### New dependency

[`vaul`](https://vaul.emilkowal.ski/) — battle-tested bottom-sheet primitive used by Linear, Vercel, and others. ~5kb gzipped. React 18 compatible. Provides drag-to-resize, snap points, focus trap, ESC handling, swipe-to-dismiss.

---

## Behavior details

**Map collapse toggle:**
- Default open. State in `localStorage`.
- When closed, the map iframe is unmounted (frees WebGL resources). When re-opened, it remounts.
- Toggle button text: `▼ Hide Map` (open state) / `▶ Show Map` (closed state).
- Replaced strip when closed: `MAP COLLAPSED · 12 CASES · 10 COUNTRIES` in muted text.

**Bottom sheet:**
- Mounted always; visibility is driven by the `?case=` URL param.
- Snap points: 30% (peek), 55% (half), 85% (full).
- Opens to 55% by default.
- Pulling up past 85% has elastic resistance. Pulling down past 30% with velocity dismisses.
- Sheet header has the same drag-handle bar pattern Vaul provides; below it sits the existing `<CaseDossier>` content unchanged.
- Background: `bg-surface` with `border-t border-border-strong`. Backdrop: 50% opacity black behind the sheet.
- Closes via × button, swipe-down, ESC key, or background tap.

**Threat banner mobile:**
- Same one-line strip but `gap-3` instead of `gap-6`.
- Pandemic % gets `text-[16px]` instead of `text-[20px]`.
- "PANDEMIC PROBABILITY" label hidden below `lg` (the `LOW` chip + percentage are enough context).
- Δ chip stays.
- Expand chevron stays. Tapping it reveals the full ThreatPanelExpanded under the strip.

**Posture matrix cards:**
- Each row gets converted to a card with `border-b border-border-soft`.
- Top line: flag + country name.
- Bottom line: small mono labels for `CASES n`, `DEATHS n`, status pill.
- Sorted same as the table (active first, then by case count).

**TopBar minimal:**
- Below `lg`: brand (P square + "PATHWATCH" wordmark) + LIVE pulse-dot. That's it.
- At `lg+`: full row including UTC, SCOPE, RISK chip.

**Trace popup width fix:**
- Already widened to 360px earlier. On `<400px` viewports that exceeds the screen.
- Change `maxWidth: '360px'` to `maxWidth: 'min(360px, 92vw)'` in MapPanel.tsx.

---

## Out of scope (defer to a follow-up)

- Touch-optimized Palantir trace gestures (pinch to zoom on the trail, etc.) — current MapLibre defaults are good enough.
- Offline mode / service worker — separate sub-project.
- Push notifications when threat level changes — separate sub-project.
- Mobile-specific marker tap-target enlargement on the map — current sizes are tappable.
- Reduced-motion preferences — Vaul respects them by default; revisit if testing flags issues.

---

## Testing

**Smoke specs continue to pass at default 1280×720 viewport** (no regressions on desktop).

**New mobile-portrait specs (viewport 390×844)** in `tests/mobile.spec.ts`:

1. **`mobile: layout stacks single-column`** — assert the desktop grid (`hidden lg:grid`) is hidden; assert `<MobileLayout>` testid is visible.
2. **`mobile: map collapse toggle hides + shows the map`** — click "Hide Map", assert map container collapsed strip is visible; click "Show Map", assert MapLibre canvas is rendered.
3. **`mobile: TopBar shows only brand + LIVE`** — assert PATHWATCH wordmark + LIVE dot visible; assert UTC, SCOPE GLOBAL, and RISK chip are not in the visible viewport.
4. **`mobile: case selection opens the bottom sheet at half snap`** — navigate `/?case=MVH-001`; assert sheet is visible; assert dossier content rendered inside; tap × button; assert sheet hidden and URL `?case=` cleared.

---

## Deployment + rollout

1. Branch `feat/mobile-responsive` pushed to GitHub.
2. Vercel auto-creates preview URL — share with user for testing on real phone.
3. Iterate on the branch as needed (each push = new preview).
4. Once approved, merge to `main` → production auto-deploys.
5. No DB schema changes; no migration risk.
