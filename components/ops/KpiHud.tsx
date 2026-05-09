'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Snapshot, Case } from '@/lib/types';
import { formatNumber, formatPercent } from '@/lib/format';

interface Props {
  snapshot: Snapshot | null;
  prevSnapshot: Snapshot | null;
  cases: Case[];
}

function delta(curr: number | null | undefined, prev: number | null | undefined, unit: 'abs' | 'pct' | 'pp') {
  if (curr == null || prev == null) return null;
  const d = curr - prev;
  if (d === 0) return null;
  const arrow = d > 0 ? '▲' : '▼';
  const tone: 'good' | 'bad' = d > 0 ? 'bad' : 'good';
  if (unit === 'abs') return { text: `${arrow} ${d > 0 ? '+' : ''}${d}`, tone };
  if (unit === 'pp') return { text: `${arrow} ${d > 0 ? '+' : ''}${(d * 100).toFixed(1)}pp`, tone };
  const pct = prev === 0 ? 0 : (d / prev) * 100;
  return { text: `${arrow} ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, tone };
}

function Row({
  label,
  value,
  d,
}: {
  label: string;
  value: string;
  d: { text: string; tone: 'good' | 'bad' } | null;
}) {
  const cls = d?.tone === 'good' ? 'text-green' : d?.tone === 'bad' ? 'text-red' : '';
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-1.5 font-mono text-[11px]">
      <span className="text-text-muted">{label}</span>
      <span className="flex items-baseline gap-2">
        {d && <span className={`text-[10px] ${cls}`}>{d.text}</span>}
        <span className="tabular-nums text-text">{value}</span>
      </span>
    </div>
  );
}

export function KpiHud({ snapshot, prevSnapshot, cases }: Props) {
  const [open, setOpen] = useState(true);
  const totalCases = snapshot?.total_cases ?? null;
  const deaths = snapshot?.total_deaths ?? null;
  const cfr = snapshot?.fatality_rate ?? null;
  const countries = snapshot?.countries_affected ?? null;
  const tracked = cases.length;
  const dCases = delta(totalCases, prevSnapshot?.total_cases, 'pct');
  const dDeaths = delta(deaths, prevSnapshot?.total_deaths, 'pct');
  const dCfr = delta(cfr, prevSnapshot?.fatality_rate, 'pp');
  const dCountries = delta(countries, prevSnapshot?.countries_affected, 'abs');

  return (
    <div className="pointer-events-auto absolute right-3 top-3 z-10 w-[240px] overflow-hidden rounded-sm border border-border-strong bg-bg-2/95 shadow-lg backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between border-b border-border px-3 py-1.5 text-left hover:bg-surface-2"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">KEY METRICS</span>
        {open ? <ChevronUp size={12} className="text-text-muted" /> : <ChevronDown size={12} className="text-text-muted" />}
      </button>
      {open && (
        <div className="divide-y divide-border-soft">
          <Row label="CASES" value={formatNumber(totalCases)} d={dCases} />
          <Row label="TRACKED" value={formatNumber(tracked)} d={null} />
          <Row label="DEATHS" value={formatNumber(deaths)} d={dDeaths} />
          <Row label="FATALITY RATE" value={formatPercent(cfr)} d={dCfr} />
          <Row label="COUNTRIES" value={formatNumber(countries)} d={dCountries} />
        </div>
      )}
    </div>
  );
}
