-- Add nationality column to cases — descriptive metadata only.
--
-- HISTORICAL NOTE: this column was originally added with the intent of having
-- country_stats group on nationality (so Dutch nationals in foreign hospitals
-- would count toward NL, not the host country). That approach was reverted in
-- the same day; country_stats.cases and .deaths are derived from
-- cases.current_country (location-based) per docs/runbooks/pipeline.md
-- "Country attribution: location-based counts". The column stays because the
-- data is accurate and may be useful for future breakdowns, but it does not
-- drive country_stats or map coloring.

ALTER TABLE cases
  ADD COLUMN nationality TEXT;

COMMENT ON COLUMN cases.nationality IS
  'ISO 3166-1 alpha-2 country code of patient nationality / primary residence. '
  'Metadata only — NOT used by country_stats. '
  'country_stats.cases and .deaths derive from cases.current_country (location-based) '
  'per docs/runbooks/pipeline.md "Country attribution: location-based counts".';

CREATE INDEX IF NOT EXISTS cases_nationality_idx ON cases (disease, nationality);
