-- Backfill case_class on pre-existing rows. No-op locally (seed runs after migrations
-- and sets case_class explicitly). Real work happens against production rows.
-- Rules per docs/superpowers/specs/2026-05-09-case-class-enum-design.md §2.

UPDATE cases
   SET case_class = 'confirmed_case'
 WHERE case_class IS NULL
   AND status IN ('confirmed', 'deceased', 'critical');

UPDATE cases
   SET case_class = 'suspected_case'
 WHERE case_class IS NULL
   AND status = 'suspected';

UPDATE cases
   SET case_class = 'returnee'
 WHERE case_class IS NULL
   AND status = 'monitoring'
   AND (case_code LIKE 'US-%' OR case_code = 'US-NE-GROUP' OR case_code LIKE 'SG-%');

UPDATE cases
   SET case_class = 'contact'
 WHERE case_class IS NULL
   AND status = 'monitoring';

-- Catch-all: rows that escaped the rules (e.g. status='recovered') default to contact.
UPDATE cases
   SET case_class = 'contact'
 WHERE case_class IS NULL;
