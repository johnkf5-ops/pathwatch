-- Adds person_count to cases. Cohort rows like US-NE-GROUP (15 Americans) and
-- NL-RAD-GROUP (12 Radboud staff) are stored as a single row but represent
-- multiple people. Dashboard counts (TopBar chips, KPI HUD tiles,
-- snapshot.total_cases/total_contacts) should SUM(person_count) rather than
-- COUNT(*) to reflect actual person counts.

ALTER TABLE cases
  ADD COLUMN person_count INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN cases.person_count IS
  'Number of individuals this row represents. Defaults to 1 for individual cases. '
  'Set to actual headcount for cohort rows (US-NE-GROUP=15, NL-RAD-GROUP=12, etc.). '
  'Dashboard counts use SUM(person_count) — not COUNT(*) — so cohorts represent '
  'their full headcount in KPI totals, snapshot.total_cases / total_contacts, and '
  'TopBar chips.';

CREATE INDEX IF NOT EXISTS cases_person_count_idx ON cases (disease, person_count);
