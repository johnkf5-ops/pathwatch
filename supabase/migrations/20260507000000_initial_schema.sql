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

-- ============================================================
-- snapshots
-- ============================================================
CREATE TABLE snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  disease TEXT DEFAULT 'hantavirus' NOT NULL,
  total_cases INTEGER,
  total_deaths INTEGER,
  countries_affected INTEGER,
  countries_list TEXT[],
  fatality_rate DOUBLE PRECISION,
  trend TEXT CHECK (trend IN ('accelerating','stable','declining')),
  trend_description TEXT,
  risk_level TEXT CHECK (risk_level IN ('low','moderate','high','critical')),
  key_developments TEXT[],
  ai_analysis TEXT
);

CREATE INDEX idx_snapshots_created_at ON snapshots (created_at DESC);
CREATE INDEX idx_snapshots_disease ON snapshots (disease);

-- ============================================================
-- country_stats
-- ============================================================
CREATE TABLE country_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  disease TEXT DEFAULT 'hantavirus' NOT NULL,
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  cases INTEGER DEFAULT 0 NOT NULL,
  deaths INTEGER DEFAULT 0 NOT NULL,
  first_case_date DATE,
  latest_case_date DATE,
  status TEXT CHECK (status IN ('active','contained','monitoring','clear')),
  travel_advisory TEXT,
  notes TEXT,
  UNIQUE (disease, country_code)
);

CREATE INDEX idx_country_stats_country ON country_stats (country_code);
CREATE INDEX idx_country_stats_disease ON country_stats (disease);

-- ============================================================
-- scrape_log (pipeline observability; not exposed to dashboard)
-- ============================================================
CREATE TABLE scrape_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  source_type TEXT NOT NULL,
  query TEXT,
  results_found INTEGER DEFAULT 0,
  events_created INTEGER DEFAULT 0,
  duplicates_skipped INTEGER DEFAULT 0,
  error TEXT,
  duration_ms INTEGER
);

CREATE INDEX idx_scrape_log_created_at ON scrape_log (created_at DESC);
CREATE INDEX idx_scrape_log_source_type ON scrape_log (source_type);

-- ============================================================
-- Row-Level Security
-- ============================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_public_read ON events FOR SELECT USING (true);

ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY snapshots_public_read ON snapshots FOR SELECT USING (true);

ALTER TABLE country_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY country_stats_public_read ON country_stats FOR SELECT USING (true);

ALTER TABLE scrape_log ENABLE ROW LEVEL SECURITY;
-- No SELECT policy: anon gets zero rows back, all writes fail.

-- ============================================================
-- Realtime publication
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE country_stats;
