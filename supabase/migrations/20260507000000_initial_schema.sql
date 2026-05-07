-- Pathwatch initial schema
-- Sub-project 1 of 4: events, snapshots, country_stats, scrape_log + RLS + realtime

-- ============================================================
-- events
-- ============================================================
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  occurred_at TIMESTAMPTZ,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  raw_content TEXT,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('x','cdc','who','google_news','reddit','bluesky','ecdc','africa_cdc','wikipedia')),
  source_url TEXT,
  source_url_hash TEXT GENERATED ALWAYS AS (md5(source_url)) STORED,
  source_author TEXT,
  significance INTEGER NOT NULL DEFAULT 1
    CHECK (significance BETWEEN 1 AND 5),
  category TEXT NOT NULL
    CHECK (category IN ('case_report','policy','research','travel_advisory','mutation','death','containment','speculation')),
  country_code TEXT,
  region TEXT,
  location_name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  case_count INTEGER,
  death_count INTEGER,
  is_verified BOOLEAN DEFAULT false NOT NULL,
  tags TEXT[],
  duplicate_of UUID REFERENCES events(id),
  disease TEXT DEFAULT 'hantavirus' NOT NULL
);

-- events indexes
CREATE INDEX idx_events_feed ON events (created_at DESC) WHERE duplicate_of IS NULL;
CREATE INDEX idx_events_significance ON events (significance DESC);
CREATE INDEX idx_events_source_type ON events (source_type);
CREATE INDEX idx_events_country_code ON events (country_code);
CREATE INDEX idx_events_category ON events (category);
CREATE INDEX idx_events_disease ON events (disease);
CREATE INDEX idx_events_tags ON events USING GIN (tags);
CREATE UNIQUE INDEX idx_events_source_url_hash
  ON events (source_url_hash) WHERE source_url_hash IS NOT NULL;
