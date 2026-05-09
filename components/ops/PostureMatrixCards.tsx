import type { CountryStat } from '@/lib/types';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { formatNumber } from '@/lib/format';
import { bySeverity } from '@/lib/country-sort';

const STATUS_TAG: Record<NonNullable<CountryStat['status']>, string> = {
  active: 'border-red text-red',
  contained: 'border-amber text-amber',
  monitoring: 'border-green text-green',
  clear: 'border-text-muted text-text-muted',
};

export function PostureMatrixCards({ countries }: { countries: CountryStat[] }) {
  const sorted = [...countries].sort(bySeverity);
  return (
    <ul className="mt-3 divide-y divide-border-soft border-y border-border-soft">
      {sorted.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-3 px-1 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <CountryFlag code={c.country_code} />
            <span className="truncate font-mono text-[12px] text-text">{c.country_name}</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
            <span className="text-text-muted">CASES <span className="text-text">{formatNumber(c.cases)}</span></span>
            <span className="text-text-muted">DEATHS <span className="text-text">{formatNumber(c.deaths)}</span></span>
            <span className={`border px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.1em] ${c.status ? STATUS_TAG[c.status] : 'border-border text-text-muted'}`}>
              {c.status ?? '—'}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
