import type { ThreatAssessment } from '@/lib/types';
import { TRIGGER_BY_ID } from '@/lib/threat-triggers';

export function TriggerWatchlist({ assessment }: { assessment: ThreatAssessment }) {
  const tripped = new Set(assessment.triggers_tripped);
  const ids = [...new Set([...assessment.triggers_watching, ...assessment.triggers_tripped])];
  return (
    <ul className="grid grid-cols-1 gap-1">
      {ids.map((id) => {
        const def = TRIGGER_BY_ID[id];
        if (!def) return null;
        const isTripped = tripped.has(id);
        const cls = isTripped ? 'border-red text-red' : 'border-border text-text-secondary';
        const status = isTripped ? 'TRIPPED' : 'WATCHING';
        return (
          <li key={id} className={`border px-2 py-1.5 font-mono text-[11px] ${cls}`}>
            <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted">{status} · </span>
            {def.label}
          </li>
        );
      })}
    </ul>
  );
}
