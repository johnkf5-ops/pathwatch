export type CaseBucket = 'low' | 'mid' | 'high' | 'monitoring' | 'none';

export const BUCKET_COLOR: Record<CaseBucket, string> = {
  low: '#FFB800',
  mid: '#FF6B35',
  high: '#FF3B3B',
  monitoring: '#1e4a5b', // muted dark teal — present-but-not-active surveillance
  none: 'transparent',
};

// Thresholds tuned for the current MV Hondius outbreak (1–2 cases per country
// in seed). Bump these as the outbreak grows.
export function caseBucket(cases: number | null | undefined): CaseBucket {
  if (cases == null || cases <= 0) return 'none';
  if (cases === 1) return 'low';
  if (cases <= 9) return 'mid';
  return 'high';
}

// Combines case-count heat scale with surveillance status: countries with
// zero cases but an active monitoring posture still show on the map.
export function countryBucket(c: { cases: number | null; status: string | null }): CaseBucket {
  const heat = caseBucket(c.cases);
  if (heat !== 'none') return heat;
  if (c.status === 'monitoring' || c.status === 'active' || c.status === 'contained') {
    return 'monitoring';
  }
  return 'none';
}

export function markerSizePx(significance: 1 | 2 | 3 | 4 | 5): number {
  return 8 + significance * 2.4;
}
