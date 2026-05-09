import type { CountryStat, CountryStatus } from '@/lib/types';

const STATUS_RANK: Record<CountryStatus, number> = {
  active: 0,
  contained: 1,
  monitoring: 2,
  clear: 3,
};

export function bySeverity(a: CountryStat, b: CountryStat): number {
  if (b.deaths !== a.deaths) return b.deaths - a.deaths;
  if (b.cases !== a.cases) return b.cases - a.cases;
  const ar = a.status ? STATUS_RANK[a.status] : 4;
  const br = b.status ? STATUS_RANK[b.status] : 4;
  return ar - br;
}
