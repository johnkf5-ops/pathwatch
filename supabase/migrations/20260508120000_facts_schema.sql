-- Pathwatch sub-project 3: facts (knowledge base)
-- Append-only; no changes to existing tables.

CREATE TABLE facts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  disease TEXT DEFAULT 'hantavirus' NOT NULL,
  category TEXT NOT NULL CHECK (category IN
    ('pathogen','transmission','clinical','epidemiology',
     'containment','history','outbreak_timeline','policy')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','corroborated','confirmed','disputed','retracted')),
  confidence DOUBLE PRECISION CHECK (confidence BETWEEN 0 AND 1),
  sources TEXT[] NOT NULL,
  source_types TEXT[],
  first_reported_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  superseded_by UUID REFERENCES facts(id),
  tags TEXT[],
  UNIQUE (disease, title)
);

CREATE INDEX idx_facts_disease ON facts (disease);
CREATE INDEX idx_facts_category ON facts (category);
CREATE INDEX idx_facts_verification ON facts (verification_status);
CREATE INDEX idx_facts_tags ON facts USING GIN (tags);

ALTER TABLE facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY facts_public_read ON facts FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE facts;
