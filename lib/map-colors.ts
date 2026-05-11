// Country choropleth coloring — location-based, deaths-beats-cases-beats-monitoring.
//
//   country has deaths > 0           → red    (death)
//   country has cases > 0, no deaths → orange (case)
//   country only has surveillance    → teal   (monitoring)
//   country has nothing              → none
//
// "country has X" means cases physically located there (current_country),
// regardless of patient nationality. country_stats.cases and .deaths are
// computed from cases.current_country grouping; see pipeline.md "Country
// attribution: location-based counts" for the runbook rule.

export type CountryBucket = 'death' | 'case' | 'monitoring' | 'none';

export const BUCKET_COLOR: Record<CountryBucket, string> = {
  death: '#FF3B3B',      // red
  case: '#FF6B35',       // orange
  monitoring: '#2d7a8f', // teal — surveillance / contacts / returnees only
  none: 'transparent',
};

export function countryBucket(c: {
  cases: number | null;
  deaths: number | null;
  status: string | null;
}): CountryBucket {
  if ((c.deaths ?? 0) > 0) return 'death';
  if ((c.cases ?? 0) > 0) return 'case';
  if (c.status === 'monitoring' || c.status === 'active' || c.status === 'contained') {
    return 'monitoring';
  }
  return 'none';
}

export function markerSizePx(significance: 1 | 2 | 3 | 4 | 5): number {
  return 8 + significance * 2.4;
}
