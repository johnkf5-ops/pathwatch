import type { Snapshot, Case } from '@/lib/types';
import { formatNumber, formatPercent } from '@/lib/format';
import { isCase, isContact } from '@/lib/case-helpers';
import { SectionHeader } from './SectionHeader';
import { KpiTile } from './KpiTile';

function delta(
  curr: number | null | undefined,
  prev: number | null | undefined,
  unit: 'abs' | 'pct' | 'pp',
): { text: string; tone: 'good' | 'bad' | 'neutral' } | null {
  if (curr == null || prev == null) return null;
  const d = curr - prev;
  if (d === 0) return null;
  const arrow = d > 0 ? '▲' : '▼';
  const tone: 'good' | 'bad' | 'neutral' = d > 0 ? 'bad' : 'good';
  if (unit === 'abs') return { text: `${arrow} ${d > 0 ? '+' : ''}${d}`, tone };
  if (unit === 'pp') return { text: `${arrow} ${d > 0 ? '+' : ''}${(d * 100).toFixed(1)}pp`, tone };
  const pct = prev === 0 ? 0 : (d / prev) * 100;
  return { text: `${arrow} ${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, tone };
}

export function KpiGrid({
  snapshot,
  prevSnapshot,
  cases: caseRows,
}: {
  snapshot: Snapshot | null;
  prevSnapshot: Snapshot | null;
  cases: Case[];
}) {
  const cases = caseRows.filter(isCase).length;
  const contacts = caseRows.filter(isContact).length;
  const deaths = snapshot?.total_deaths ?? null;
  const cfr = snapshot?.fatality_rate ?? null;
  const countries = snapshot?.countries_affected ?? null;
  const dCases = delta(cases, prevSnapshot?.total_cases, 'pct');
  const dDeaths = delta(deaths, prevSnapshot?.total_deaths, 'pct');
  const dCfr = delta(cfr, prevSnapshot?.fatality_rate, 'pp');
  const dCountries = delta(countries, prevSnapshot?.countries_affected, 'abs');

  return (
    <section className="border-b border-border px-4 py-4">
      <SectionHeader>KEY METRICS</SectionHeader>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <KpiTile
          testId="kpi-cases"
          label="CASES"
          value={formatNumber(cases)}
          subtitle="CONFIRMED + PROBABLE + SUSPECTED"
          delta={dCases?.text}
          deltaTone={dCases?.tone}
        />
        <KpiTile
          testId="kpi-contacts"
          label="CONTACTS"
          value={formatNumber(contacts)}
          subtitle="MONITORED CONTACTS + RETURNEES"
        />
        <KpiTile testId="kpi-deaths" label="DEATHS" value={formatNumber(deaths)} delta={dDeaths?.text} deltaTone={dDeaths?.tone} />
        <KpiTile testId="kpi-cfr" label="FATALITY RATE" value={formatPercent(cfr)} delta={dCfr?.text} deltaTone={dCfr?.tone} />
        <KpiTile testId="kpi-countries" label="COUNTRIES" value={formatNumber(countries)} delta={dCountries?.text} deltaTone="neutral" />
      </div>
    </section>
  );
}
