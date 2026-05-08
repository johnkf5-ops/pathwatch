import type { ThreatAssessment } from '@/lib/types';

interface Pill { label: string; value: string; cls: string; }

function pills(a: ThreatAssessment): Pill[] {
  const out: Pill[] = [];
  if (a.r0_estimate != null) {
    const ok = a.r0_estimate < 1;
    out.push({
      label: 'R0',
      value: a.r0_estimate.toFixed(2),
      cls: ok ? 'text-green border-green' : 'text-red border-red',
    });
  }
  if (a.mutation_status) {
    const cls =
      a.mutation_status === 'none_detected' ? 'text-green border-green'
      : a.mutation_status === 'monitoring'  ? 'text-amber border-amber'
      : a.mutation_status === 'concerning'  ? 'text-orange border-orange'
      :                                       'text-red border-red';
    out.push({
      label: 'MUTATIONS',
      value: a.mutation_status.replace('_', ' ').toUpperCase(),
      cls,
    });
  }
  if (a.secondary_attack_rate != null) {
    const ok = a.secondary_attack_rate < 0.05;
    out.push({
      label: 'SAR',
      value: `${(a.secondary_attack_rate * 100).toFixed(1)}%`,
      cls: ok ? 'text-green border-green' : 'text-red border-red',
    });
  }
  if (a.containment_effectiveness) {
    const cls =
      a.containment_effectiveness === 'effective'           ? 'text-green border-green'
      : a.containment_effectiveness === 'partially_effective' ? 'text-amber border-amber'
      : a.containment_effectiveness === 'failing'             ? 'text-red border-red'
      :                                                          'text-text-secondary border-text-secondary';
    out.push({
      label: 'CONTAINMENT',
      value: a.containment_effectiveness.replace('_', ' ').toUpperCase(),
      cls,
    });
  }
  if (a.case_doubling_days != null) {
    out.push({
      label: 'DOUBLING',
      value: `${a.case_doubling_days.toFixed(1)}d`,
      cls: 'text-amber border-amber',
    });
  }
  return out;
}

export function SignalIndicators({ assessment }: { assessment: ThreatAssessment }) {
  return (
    <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.14em]">
      {pills(assessment).map((p) => (
        <span key={p.label} className={`border px-2 py-0.5 ${p.cls}`}>
          <span className="text-text-muted">{p.label}</span> <span>{p.value}</span>
        </span>
      ))}
    </div>
  );
}
