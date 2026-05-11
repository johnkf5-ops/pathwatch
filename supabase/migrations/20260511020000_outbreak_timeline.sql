-- outbreak_timeline — one row per day of an outbreak, surfaced in the
-- SituationBrief's left-column rail. Day 1 anchors when the public chronology
-- begins (e.g. 2026-05-01 for MV Hondius). Each cycle's pipeline agent
-- upserts the row for the current day with a short snippet (~70 chars).

CREATE TABLE outbreak_timeline (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  disease TEXT DEFAULT 'hantavirus' NOT NULL,
  day_num INTEGER NOT NULL,
  occurred_on DATE NOT NULL,
  snippet TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (disease, day_num)
);

CREATE INDEX idx_outbreak_timeline_day ON outbreak_timeline (disease, day_num DESC);

ALTER TABLE outbreak_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY outbreak_timeline_public_read
  ON outbreak_timeline FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE outbreak_timeline;

COMMENT ON TABLE outbreak_timeline IS
  'Day-by-day outbreak chronology surfaced in the SituationBrief left rail. '
  'Pipeline upserts one row per day; (disease, day_num) is the key.';
