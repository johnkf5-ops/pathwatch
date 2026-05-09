-- Adds case_class enum to disambiguate "what kind of row" (case vs. contact)
-- from the lifecycle status. See docs/superpowers/specs/2026-05-09-case-class-enum-design.md.
-- Nullable for now; backfill migration follows; NOT NULL is the last migration in this set.

ALTER TABLE cases
  ADD COLUMN case_class TEXT
    CHECK (case_class IN (
      'confirmed_case',
      'probable_case',
      'suspected_case',
      'contact',
      'returnee'
    ));

CREATE INDEX idx_cases_class ON cases (case_class);
CREATE INDEX idx_cases_class_disease ON cases (disease, case_class);
