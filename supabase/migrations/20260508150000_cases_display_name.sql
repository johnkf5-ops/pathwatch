-- Human-readable case label (e.g. "Dutch retiree, F, 60s") shown in the UI.
-- case_code remains the stable identifier used in URLs and joins.
ALTER TABLE cases ADD COLUMN display_name TEXT;
