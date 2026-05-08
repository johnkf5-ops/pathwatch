import type { CountryStat } from '@/lib/types';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { Badge } from '@/components/ui/Badge';
import { formatNumber } from '@/lib/format';

export function CountryTooltip({ country }: { country: CountryStat }) {
  return (
    <div className="min-w-[180px] text-text">
      <div className="mb-2 flex items-center gap-2">
        <CountryFlag code={country.country_code} className="text-xl" />
        <h4 className="text-sm font-semibold">{country.country_name}</h4>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-text-muted">Cases</dt>
        <dd className="font-mono tabular-nums">{formatNumber(country.cases)}</dd>
        <dt className="text-text-muted">Deaths</dt>
        <dd className="font-mono tabular-nums">{formatNumber(country.deaths)}</dd>
        <dt className="text-text-muted">First case</dt>
        <dd>{country.first_case_date ?? '—'}</dd>
        <dt className="text-text-muted">Latest</dt>
        <dd>{country.latest_case_date ?? '—'}</dd>
      </dl>
      {country.status && (
        <div className="mt-2">
          <Badge variant="outline">{country.status}</Badge>
        </div>
      )}
    </div>
  );
}
