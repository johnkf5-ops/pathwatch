-- Adds a parallel headline number for contacts/returnees alongside total_cases.
-- Pipeline writes both; UI derives display values from cases when needed.

ALTER TABLE snapshots ADD COLUMN total_contacts INTEGER;
