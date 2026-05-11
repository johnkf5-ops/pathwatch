-- Add nationality column to cases. Country_stats.cases / .deaths counts will
-- group by nationality instead of current_country so that Dutch nationals
-- hospitalized in foreign treatment sites count toward NL (the actual outbreak
-- country), not toward whatever hospital happens to host them.
--
-- See docs/runbooks/pipeline.md "Country attribution: nationality-based counts"
-- for the rule.

ALTER TABLE cases
  ADD COLUMN nationality TEXT;

COMMENT ON COLUMN cases.nationality IS
  'ISO 3166-1 alpha-2 country code of patient nationality / primary residence. '
  'country_stats.cases and .deaths are derived by grouping cases on this column. '
  'Nullable for cases where nationality is genuinely unknown; the operator '
  'should backfill from dossier / source reporting when possible.';

CREATE INDEX IF NOT EXISTS cases_nationality_idx ON cases (disease, nationality);
