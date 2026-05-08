-- Allow 'monitoring' as a status (people in their exposure window who are
-- not yet symptomatic / classified). Adds clearance_date for the 42-day
-- countdown.
ALTER TABLE cases DROP CONSTRAINT cases_status_check;
ALTER TABLE cases ADD CONSTRAINT cases_status_check
  CHECK (status IN ('monitoring', 'suspected', 'confirmed', 'recovered', 'deceased', 'critical'));

ALTER TABLE cases ADD COLUMN clearance_date DATE;
