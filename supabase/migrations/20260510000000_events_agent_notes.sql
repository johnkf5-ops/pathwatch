-- Write-time rigor amendment: agent reasoning trace
-- Spec: docs/superpowers/specs/2026-05-10-write-time-rigor-amendment.md §4
--
-- Internal-only column — never projected to public dashboard surfaces.
-- Populated by the pipeline agent for sig-4+ events carrying any of:
--   binary-policy | policy-ambiguity | paraphrased | policy-clarification
-- Routine descriptive sig-4+ events leave this NULL.

ALTER TABLE events
  ADD COLUMN agent_notes TEXT;

COMMENT ON COLUMN events.agent_notes IS
  'Agent-authored reasoning trace for sig-4+ events with binary-policy, '
  'policy-ambiguity, paraphrased, or policy-clarification tags. '
  'Internal-only; never surfaced to public UI.';
