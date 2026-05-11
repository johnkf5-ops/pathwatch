-- snapshots.headline — one short line surfaced at the top of the SituationBrief
-- (e.g. "Day 11 — Dispersal monitoring phase begins. Three U.S. confirmed.")
-- Spec: SituationBrief refactor 2026-05-11.

ALTER TABLE snapshots
  ADD COLUMN headline TEXT;

COMMENT ON COLUMN snapshots.headline IS
  'Short sit-rep headline (one line, ~100 chars max). Surfaces above '
  'ai_analysis prose and key_developments bullets in SituationBrief. '
  'Distinct from trend_description (which is a short trend label).';
