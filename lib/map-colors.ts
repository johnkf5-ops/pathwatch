export type CaseBucket = 'low' | 'mid' | 'high' | 'none';

export const BUCKET_COLOR: Record<CaseBucket, string> = {
  low: '#FFB800',
  mid: '#FF6B35',
  high: '#FF3B3B',
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

export function markerSizePx(significance: 1 | 2 | 3 | 4 | 5): number {
  return 8 + significance * 2.4;
}
