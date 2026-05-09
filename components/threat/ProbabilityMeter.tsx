import type { ThreatAssessment } from '@/lib/types';
import { THREAT_LEVEL_TOKEN } from '@/lib/threat-triggers';

export function ProbabilityMeter({ assessment }: { assessment: ThreatAssessment }) {
  const t = THREAT_LEVEL_TOKEN[assessment.threat_level];
  const pct = (assessment.pandemic_probability * 100).toFixed(1);
  return (
    <div className="flex items-center gap-3">
      <span className={`inline-block h-2 w-2 rounded-full ${t.dotCls}`} />
      <span className={`border px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] ${t.borderCls} ${t.textCls}`}>
        {t.label}
      </span>
      <span className="font-mono text-[16px] font-semibold leading-none text-text lg:text-[20px]">
        {pct}%
      </span>
      <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted lg:inline">
        PANDEMIC PROBABILITY
      </span>
    </div>
  );
}
