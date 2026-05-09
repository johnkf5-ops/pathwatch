'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Case, CaseClass } from '@/lib/types';
import { clearanceFor, caseLabel } from '@/lib/case-helpers';
import { SectionHeader } from './SectionHeader';

const TONE_CLS: Record<string, string> = {
  green:   'border-green text-green',
  amber:   'border-amber text-amber',
  orange:  'border-orange text-orange',
  red:     'border-red text-red',
  cleared: 'border-text-muted text-text-muted',
};

type Filter = 'all' | 'contact' | 'returnee';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'contact', label: 'CONTACTS' },
  { id: 'returnee', label: 'RETURNEES' },
];

function matches(c: Case, filter: Filter): boolean {
  if (filter === 'all') return true;
  return c.case_class === (filter as CaseClass);
}

export function MonitoringCohort({ cases }: { cases: Case[] }) {
  const [filter, setFilter] = useState<Filter>('all');

  if (cases.length === 0) {
    return (
      <section className="px-4 py-4">
        <SectionHeader>MONITORING</SectionHeader>
        <p className="mt-2 text-sm text-text-muted">No people in active monitoring.</p>
      </section>
    );
  }

  const filtered = cases.filter((c) => matches(c, filter));
  const ranked = [...filtered].sort((a, b) => {
    const ca = clearanceFor(a.clearance_date, a.exposure_date);
    const cb = clearanceFor(b.clearance_date, b.exposure_date);
    const da = ca?.daysRemaining ?? Number.POSITIVE_INFINITY;
    const db = cb?.daysRemaining ?? Number.POSITIVE_INFINITY;
    return da - db;
  });
  const closingSoon = ranked.filter((c) => {
    const r = clearanceFor(c.clearance_date, c.exposure_date);
    return r && !r.cleared && r.daysRemaining < 7;
  }).length;

  return (
    <section className="px-4 py-4">
      <div className="flex items-baseline justify-between">
        <SectionHeader>MONITORING</SectionHeader>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
          {ranked.length} TOTAL{closingSoon > 0 ? ` · ${closingSoon} <7D` : ''}
        </span>
      </div>
      <div className="mt-2 flex gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`border px-2 py-0.5 font-mono text-[10px] tracking-[0.1em] ${
              filter === f.id
                ? 'border-green text-green'
                : 'border-border text-text-muted hover:text-text'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {ranked.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">No matches.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {ranked.map((c) => {
            const r = clearanceFor(c.clearance_date, c.exposure_date);
            const tone = r?.tone ?? 'cleared';
            const days = r ? (r.cleared ? 'CLEARED' : `${r.daysRemaining}D`) : '—';
            const where = c.exposure_country ? `· ${c.exposure_country}` : '';
            return (
              <li key={c.id}>
                <Link
                  href={`/?case=${c.case_code}`}
                  className="flex items-center gap-2 border border-border bg-surface px-2 py-1.5 hover:bg-surface-2"
                  scroll={false}
                >
                  <span className="truncate font-mono text-[11px] text-text">{caseLabel(c)}</span>
                  <span className="truncate text-[11px] text-text-secondary">
                    {c.role ? c.role.replace('_', ' ').toUpperCase() : 'CONTACT'} {where}
                  </span>
                  <span
                    className={`ml-auto inline-flex items-center border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.1em] ${TONE_CLS[tone]}`}
                    title={r?.totalWindowDays ? `${r.totalWindowDays}-day exposure window` : undefined}
                  >
                    {days}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
