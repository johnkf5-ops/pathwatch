import type { Snapshot } from '@/lib/types';
import { formatNumber, formatPercent } from '@/lib/format';
import { StatCard } from '@/components/ui/StatCard';
import { RiskBadge } from '@/components/ui/RiskBadge';

export function SituationOverview({ snapshot }: { snapshot: Snapshot | null }) {
  if (!snapshot) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6">
        <p className="text-text-secondary">
          Awaiting first snapshot. The pipeline will populate this panel.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard testId="stat-cases" label="Total cases" value={formatNumber(snapshot.total_cases)} />
        <StatCard testId="stat-deaths" label="Deaths" value={formatNumber(snapshot.total_deaths)} />
        <StatCard
          testId="stat-countries"
          label="Countries"
          value={formatNumber(snapshot.countries_affected)}
          hint={snapshot.countries_list?.join(', ')}
        />
        <StatCard testId="stat-fatality" label="Fatality rate" value={formatPercent(snapshot.fatality_rate)} />
        <div className="flex flex-col items-start justify-between rounded-xl border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">Risk level</div>
          <RiskBadge level={snapshot.risk_level} />
        </div>
      </div>
      {snapshot.ai_analysis && (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-text-secondary">
          {snapshot.ai_analysis}
        </p>
      )}
    </section>
  );
}
