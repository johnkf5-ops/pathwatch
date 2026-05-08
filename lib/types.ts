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

export type CaseStatus = 'suspected' | 'confirmed' | 'recovered' | 'deceased' | 'critical';
export type CaseRole = 'passenger' | 'crew' | 'contact' | 'healthcare_worker' | 'rural_resident' | 'other';
export type ExposureType = 'rodent_contact' | 'person_to_person' | 'unknown';

export interface Case {
  id: string;
  created_at: string;
  updated_at: string;
  case_code: string;
  disease: string;
  status: CaseStatus;
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
