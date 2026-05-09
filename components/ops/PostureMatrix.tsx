import type { CountryStat } from '@/lib/types';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { formatNumber } from '@/lib/format';
import { bySeverity } from '@/lib/country-sort';
import { SectionHeader } from './SectionHeader';
import { PostureMatrixCards } from './PostureMatrixCards';

const STATUS_TAG: Record<NonNullable<CountryStat['status']>, string> = {
  active: 'text-red',
  contained: 'text-amber',
  monitoring: 'text-green',
  clear: 'text-text-muted',
};

function intensity(value: number, kind: 'cases' | 'deaths'): string {
  if (value <= 0) return 'transparent';
  const buckets = kind === 'cases' ? [1, 2, 4, 10] : [0, 1, 2, 5];
  if (value >= buckets[3]) return 'rgba(255,77,94,0.45)';
  if (value >= buckets[2]) return 'rgba(255,127,63,0.32)';
  if (value >= buckets[1]) return 'rgba(245,176,65,0.22)';
  return 'rgba(46,227,122,0.12)';
}

function dark(value: number, kind: 'cases' | 'deaths'): boolean {
  const buckets = kind === 'cases' ? [10] : [5];
  return value >= buckets[0];
}

export function PostureMatrix({ countries }: { countries: CountryStat[] }) {
  if (countries.length === 0) {
    return (
      <section className="border-b border-border px-4 py-4">
        <SectionHeader>COUNTRIES AFFECTED</SectionHeader>
        <p className="mt-2 text-sm text-text-muted">No country data yet.</p>
      </section>
    );
  }

  const sorted = [...countries].sort(bySeverity);

  return (
    <section className="border-b border-border px-4 py-4">
      <SectionHeader>COUNTRIES AFFECTED</SectionHeader>

      {/* Mobile: card list */}
      <div className="lg:hidden">
        <PostureMatrixCards countries={countries} />
      </div>

      {/* Desktop: table */}
      <table className="mt-3 hidden w-full font-mono text-[11.5px] lg:table">
        <thead className="text-text-muted">
          <tr className="border-b border-border-soft">
            <th className="px-2 py-1 text-left font-medium">COUNTRY</th>
            <th className="px-2 py-1 text-right font-medium">CASES</th>
            <th className="px-2 py-1 text-right font-medium">DEATHS</th>
            <th className="px-2 py-1 text-left font-medium">STATUS</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.id} className="border-b border-border-soft last:border-0">
              <td className="px-2 py-1.5">
                <span className="mr-2"><CountryFlag code={c.country_code} /></span>
                <span className="text-text">{c.country_name}</span>
              </td>
              <td
                className="px-2 py-1.5 text-right tabular-nums"
                style={{ background: intensity(c.cases, 'cases'), color: dark(c.cases, 'cases') ? '#0b0d13' : undefined }}
              >
                {formatNumber(c.cases)}
              </td>
              <td
                className="px-2 py-1.5 text-right tabular-nums"
                style={{ background: intensity(c.deaths, 'deaths'), color: dark(c.deaths, 'deaths') ? '#0b0d13' : undefined }}
              >
                {formatNumber(c.deaths)}
              </td>
              <td className={`px-2 py-1.5 ${c.status ? STATUS_TAG[c.status] : 'text-text-muted'}`}>
                {c.status ? c.status.toUpperCase() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
