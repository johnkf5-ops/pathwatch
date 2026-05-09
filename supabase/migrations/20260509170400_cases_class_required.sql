-- Lock case_class as required after backfill + seed coverage are confirmed.
-- Production: run only after the operator has verified zero NULLs via:
--   select count(*) from cases where case_class is null;

ALTER TABLE cases ALTER COLUMN case_class SET NOT NULL;
