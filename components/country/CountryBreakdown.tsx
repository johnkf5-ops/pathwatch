'use client';
import { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { CountryStat } from '@/lib/types';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { Badge } from '@/components/ui/Badge';
import { formatNumber } from '@/lib/format';

type SortKey = 'country_name' | 'cases' | 'deaths' | 'first_case_date' | 'latest_case_date';

export function CountryBreakdown({ rows }: { rows: CountryStat[] }) {
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

  function header(key: SortKey, label: string) {
    const active = sort.key === key;
    return (
      <Th>
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
      </Th>
    );
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Country breakdown</h2>
      <Table>
        <Thead>
          <Tr>
            <Th>Flag</Th>
            {header('country_name', 'Country')}
            {header('cases', 'Cases')}
            {header('deaths', 'Deaths')}
            <Th>Status</Th>
            {header('first_case_date', 'First case')}
            {header('latest_case_date', 'Latest update')}
          </Tr>
        </Thead>
        <Tbody>
          {sorted.map((r) => (
            <Tr key={r.id}>
              <Td>
                <CountryFlag code={r.country_code} />
              </Td>
              <Td className="font-medium">{r.country_name}</Td>
              <Td className="font-mono tabular-nums">{formatNumber(r.cases)}</Td>
              <Td className="font-mono tabular-nums">{formatNumber(r.deaths)}</Td>
              <Td>
                {r.status ? (
                  <Badge variant="outline">{r.status}</Badge>
                ) : (
                  <span className="text-text-muted">—</span>
                )}
              </Td>
              <Td className="text-text-secondary">{r.first_case_date ?? '—'}</Td>
              <Td className="text-text-secondary">{r.latest_case_date ?? '—'}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </section>
  );
}
