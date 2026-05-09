-- Recount country_stats.cases from cases by class, keyed on current_country.
-- Per spec §3.5 + §8 resolution: "where the case is now" matches map markers
-- and the PostureMatrix list semantics. case_class IN (confirmed, probable, suspected).

UPDATE country_stats cs
SET cases = (
  SELECT count(*) FROM cases c
  WHERE c.disease = cs.disease
    AND c.current_country = cs.country_code
    AND c.case_class IN ('confirmed_case','probable_case','suspected_case')
);
