-- Pathwatch sub-project 2.5: cases + case_locations
-- Additive migration; no changes to existing tables.

-- ============================================================
-- cases
-- ============================================================
CREATE TABLE cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  case_code TEXT UNIQUE NOT NULL,
  disease TEXT DEFAULT 'hantavirus' NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('suspected','confirmed','recovered','deceased','critical')),
  is_index_case BOOLEAN DEFAULT false NOT NULL,
  role TEXT
    CHECK (role IN ('passenger','crew','contact','healthcare_worker','rural_resident','other')),
  exposure_type TEXT
    CHECK (exposure_type IN ('rodent_contact','person_to_person','unknown')),
  age_range TEXT,
  sex TEXT CHECK (sex IN ('M','F','U')),
  exposure_country TEXT,
  exposure_date DATE,
  onset_date DATE,
  confirmed_date DATE,
  outcome_date DATE,
  current_country TEXT,
  dossier TEXT,
  notes TEXT,
  source_event_id UUID REFERENCES events(id)
);

CREATE INDEX idx_cases_disease ON cases (disease);
CREATE INDEX idx_cases_status ON cases (status);
CREATE INDEX idx_cases_current_country ON cases (current_country);
CREATE INDEX idx_cases_exposure_country ON cases (exposure_country);
CREATE INDEX idx_cases_index ON cases (is_index_case) WHERE is_index_case = true;

-- ============================================================
-- case_locations
-- ============================================================
CREATE TABLE case_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  region TEXT,
  location_name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  arrived_at TIMESTAMPTZ NOT NULL,
  departed_at TIMESTAMPTZ,
  context TEXT,
  is_exposure_site BOOLEAN DEFAULT false NOT NULL
);

CREATE INDEX idx_case_locations_case ON case_locations (case_id, arrived_at);
CREATE INDEX idx_case_locations_country ON case_locations (country_code);

-- ============================================================
-- Row-Level Security
-- ============================================================
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY cases_public_read ON cases FOR SELECT USING (true);

ALTER TABLE case_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY case_locations_public_read ON case_locations FOR SELECT USING (true);
