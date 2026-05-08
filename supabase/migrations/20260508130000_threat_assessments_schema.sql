CREATE TABLE threat_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  disease TEXT DEFAULT 'hantavirus' NOT NULL,

  model TEXT NOT NULL,
  pipeline_session_id TEXT,

  pandemic_probability DOUBLE PRECISION NOT NULL CHECK (pandemic_probability BETWEEN 0 AND 1),
  threat_level TEXT NOT NULL CHECK (threat_level IN ('minimal','low','moderate','elevated','high','critical')),
  summary TEXT NOT NULL,
  reasoning TEXT NOT NULL,

  r0_estimate DOUBLE PRECISION,
  r0_assessment TEXT,
  mutation_status TEXT CHECK (mutation_status IN ('none_detected','monitoring','concerning','critical')),
  mutation_notes TEXT,
  secondary_attack_rate DOUBLE PRECISION,
  secondary_attack_notes TEXT,
  case_doubling_days DOUBLE PRECISION,
  containment_effectiveness TEXT CHECK (containment_effectiveness IN ('effective','partially_effective','failing','unknown')),

  polymarket_pandemic_odds DOUBLE PRECISION,
  polymarket_us_case_odds DOUBLE PRECISION,
  polymarket_vaccine_odds DOUBLE PRECISION,
  polymarket_lab_leak_odds DOUBLE PRECISION,
  polymarket_fetched_at TIMESTAMPTZ,
  ai_vs_market_note TEXT,

  triggers_watching TEXT[] NOT NULL DEFAULT '{}',
  triggers_tripped TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_threat_created ON threat_assessments (created_at DESC);
CREATE INDEX idx_threat_disease ON threat_assessments (disease);

ALTER TABLE threat_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY threat_public_read ON threat_assessments FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE threat_assessments;
