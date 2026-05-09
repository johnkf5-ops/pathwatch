-- supabase/migrations/20260509160000_visitor_log.sql
-- Lightweight visitor counter. One row per browser-localStorage UUID,
-- so "total" approximates unique visitors (caveat: clearing localStorage
-- recounts). Public read + public insert via RLS; unique constraint on
-- visitor_id makes repeat inserts a no-op.

CREATE TABLE visitor_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT UNIQUE NOT NULL,
  first_seen_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  user_agent TEXT
);

CREATE INDEX idx_visitor_log_first_seen ON visitor_log (first_seen_at DESC);

ALTER TABLE visitor_log ENABLE ROW LEVEL SECURITY;

-- Anyone can read (we just expose the count, never the rows themselves to UI)
CREATE POLICY visitor_log_public_read ON visitor_log FOR SELECT USING (true);

-- Anyone can insert their own row; UNIQUE on visitor_id prevents double-counting
CREATE POLICY visitor_log_public_insert ON visitor_log FOR INSERT WITH CHECK (true);

-- Realtime so the displayed count updates as people land
ALTER PUBLICATION supabase_realtime ADD TABLE visitor_log;
