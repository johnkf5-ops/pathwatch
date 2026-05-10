-- Write-time rigor amendment Task 18: close the realtime publication leak
-- Spec: docs/runbooks/pipeline.md §E "Residual: Realtime broadcasts the full row"
--
-- Before this migration: ALTER PUBLICATION supabase_realtime ADD TABLE events
-- (no column filter) broadcasts every column on every INSERT/UPDATE to all
-- anonymous WebSocket subscribers — including agent_notes once the pipeline
-- begins populating it.
--
-- This migration narrows the publication's events row to exactly the 22
-- columns the dashboard projects via EVENT_PUBLIC_COLUMNS in lib/types.ts.
-- agent_notes stays out of the broadcast. source_url_hash is omitted to
-- match the pre-migration broadcast (it's a GENERATED ALWAYS AS STORED
-- column that Postgres logical replication auto-excludes anyway).
--
-- DROP+ADD pattern (rather than SET TABLE) preserves the other 7 tables
-- in the publication unchanged. The whole migration runs in one
-- transaction so realtime never drops events mid-window.

ALTER PUBLICATION supabase_realtime DROP TABLE public.events;

ALTER PUBLICATION supabase_realtime ADD TABLE public.events (
  id,
  created_at,
  occurred_at,
  title,
  summary,
  raw_content,
  source_type,
  source_url,
  source_author,
  significance,
  category,
  country_code,
  region,
  location_name,
  latitude,
  longitude,
  case_count,
  death_count,
  is_verified,
  tags,
  duplicate_of,
  disease
);
