'use client';
import { useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { CountryStat } from '@/lib/types';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { formatNumber } from '@/lib/format';

const STATUS_TAG: Record<NonNullable<CountryStat['status']>, string> = {
  active: 'text-red',
  contained: 'text-amber',
  monitoring: 'text-green',
  clear: 'text-text-muted',
};

type SortKey = 'country_name' | 'cases' | 'deaths' | 'first_case_date' | 'latest_case_date';

export function ByCountryPane({ rows }: { rows: CountryStat[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'cases',
    dir: 'desc',
  });

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return sort.dir === 'asc' ? -1 : 1;
    if (av > bv) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  function header(key: SortKey, label: string, align: 'left' | 'right' = 'left') {
    const active = sort.key === key;
    return (
      <th className={`px-3 py-2 text-${align} font-medium`}>
        <button
          className="inline-flex items-center gap-1 hover:text-text"
          onClick={() =>
            setSort((s) =>
              s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' },
            )
          }
        >
          {label}
          {active && (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
        </button>
      </th>
    );
  }

  function selectCountry(code: string) {
    const u = new URLSearchParams(searchParams.toString());
    u.delete('case');
    u.set('country', code);
    router.replace(`${pathname}?${u.toString()}`, { scroll: false });
  }

  return (
    <div className="overflow-y-auto">
      <table className="w-full font-mono text-[11.5px]">
        <thead className="border-b border-border text-text-muted">
          <tr>
            <th className="px-3 py-2 text-left font-medium">FLAG</th>
            {header('country_name', 'COUNTRY')}
            {header('cases', 'CASES', 'right')}
            {header('deaths', 'DEATHS', 'right')}
            <th className="px-3 py-2 text-left font-medium">STATUS</th>
            {header('first_case_date', 'FIRST')}
            {header('latest_case_date', 'LATEST')}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.id}
              className="cursor-pointer border-b border-border-soft last:border-0 hover:bg-surface-2"
              onClick={() => selectCountry(r.country_code)}
            >
              <td className="px-3 py-2"><CountryFlag code={r.country_code} /></td>
              <td className="px-3 py-2 text-text">{r.country_name}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.cases)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.deaths)}</td>
              <td className={`px-3 py-2 ${r.status ? STATUS_TAG[r.status] : 'text-text-muted'}`}>
                {r.status ? r.status.toUpperCase() : '—'}
              </td>
              <td className="px-3 py-2 text-text-secondary">{r.first_case_date ?? '—'}</td>
              <td className="px-3 py-2 text-text-secondary">{r.latest_case_date ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
