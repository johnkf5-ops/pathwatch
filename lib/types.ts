export type SourceType =
  | 'x' | 'cdc' | 'who' | 'google_news' | 'reddit' | 'bluesky'
  | 'ecdc' | 'africa_cdc' | 'wikipedia';

export type Category =
  | 'case_report' | 'policy' | 'research' | 'travel_advisory'
  | 'mutation' | 'death' | 'containment' | 'speculation';

export type Significance = 1 | 2 | 3 | 4 | 5;

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';
export type Trend = 'accelerating' | 'stable' | 'declining';
export type CountryStatus = 'active' | 'contained' | 'monitoring' | 'clear';

export interface Event {
  id: string;
  created_at: string;
  occurred_at: string | null;
  title: string;
  summary: string;
  raw_content: string | null;
  source_type: SourceType;
  source_url: string | null;
  source_url_hash: string | null;
  source_author: string | null;
  significance: Significance;
  category: Category;
  country_code: string | null;
  region: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  case_count: number | null;
  death_count: number | null;
  is_verified: boolean;
  tags: string[] | null;
  duplicate_of: string | null;
  disease: string;
}

export interface Snapshot {
  id: string;
  created_at: string;
  disease: string;
  total_cases: number | null;
  total_contacts: number | null;
  total_deaths: number | null;
  countries_affected: number | null;
  countries_list: string[] | null;
  fatality_rate: number | null;
  trend: Trend | null;
  trend_description: string | null;
  risk_level: RiskLevel | null;
  key_developments: string[] | null;
  ai_analysis: string | null;
}

export interface CountryStat {
  id: string;
  updated_at: string;
  disease: string;
  country_code: string;
  country_name: string;
  cases: number;
  deaths: number;
  first_case_date: string | null;
  latest_case_date: string | null;
  status: CountryStatus | null;
  travel_advisory: string | null;
  notes: string | null;
}

export interface FilterState {
  significance: Significance | null;
  source: SourceType | null;
  category: Category | null;
  limit: number;
}

export type CaseStatus = 'monitoring' | 'suspected' | 'confirmed' | 'recovered' | 'deceased' | 'critical';
export type CaseClass = 'confirmed_case' | 'probable_case' | 'suspected_case' | 'contact' | 'returnee';
export type CaseRole = 'passenger' | 'crew' | 'contact' | 'healthcare_worker' | 'rural_resident' | 'other';
export type ExposureType = 'rodent_contact' | 'person_to_person' | 'unknown';

export interface Case {
  id: string;
  created_at: string;
  updated_at: string;
  case_code: string;
  disease: string;
  status: CaseStatus;
  case_class: CaseClass;
  is_index_case: boolean;
  role: CaseRole | null;
  exposure_type: ExposureType | null;
  age_range: string | null;
  sex: 'M' | 'F' | 'U' | null;
  exposure_country: string | null;
  exposure_date: string | null;
  onset_date: string | null;
  confirmed_date: string | null;
  outcome_date: string | null;
  current_country: string | null;
  dossier: string | null;
  notes: string | null;
  source_event_id: string | null;
  clearance_date: string | null;
  display_name: string | null;
}

export interface CaseLocation {
  id: string;
  case_id: string;
  country_code: string;
  region: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  arrived_at: string;
  departed_at: string | null;
  context: string | null;
  is_exposure_site: boolean;
}

export type FactCategory =
  | 'pathogen' | 'transmission' | 'clinical' | 'epidemiology'
  | 'containment' | 'history' | 'outbreak_timeline' | 'policy';

export type VerificationStatus =
  | 'unverified' | 'corroborated' | 'confirmed' | 'disputed' | 'retracted';

export interface Fact {
  id: string;
  created_at: string;
  updated_at: string;
  disease: string;
  category: FactCategory;
  title: string;
  content: string;
  verification_status: VerificationStatus;
  confidence: number | null;
  sources: string[];
  source_types: string[] | null;
  first_reported_at: string | null;
  last_verified_at: string | null;
  superseded_by: string | null;
  tags: string[] | null;
}

export type ThreatLevel = 'minimal' | 'low' | 'moderate' | 'elevated' | 'high' | 'critical';
export type MutationStatus = 'none_detected' | 'monitoring' | 'concerning' | 'critical';
export type ContainmentEffectiveness = 'effective' | 'partially_effective' | 'failing' | 'unknown';

export interface ThreatAssessment {
  id: string;
  created_at: string;
  disease: string;
  model: string;
  pipeline_session_id: string | null;
  pandemic_probability: number;
  threat_level: ThreatLevel;
  summary: string;
  reasoning: string;
  r0_estimate: number | null;
  r0_assessment: string | null;
  mutation_status: MutationStatus | null;
  mutation_notes: string | null;
  secondary_attack_rate: number | null;
  secondary_attack_notes: string | null;
  case_doubling_days: number | null;
  containment_effectiveness: ContainmentEffectiveness | null;
  polymarket_pandemic_odds: number | null;
  polymarket_us_case_odds: number | null;
  polymarket_vaccine_odds: number | null;
  polymarket_lab_leak_odds: number | null;
  polymarket_fetched_at: string | null;
  ai_vs_market_note: string | null;
  triggers_watching: string[];
  triggers_tripped: string[];
}
