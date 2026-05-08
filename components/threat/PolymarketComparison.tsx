import type { ThreatAssessment } from '@/lib/types';

export function PolymarketComparison({ assessment }: { assessment: ThreatAssessment }) {
  const ai = assessment.pandemic_probability;
  const market = assessment.polymarket_pandemic_odds;
  if (market == null) return null;
  const delta = ai - market;
  const dir = delta < 0 ? 'BELOW' : delta > 0 ? 'ABOVE' : 'EVEN';
  const cls =
    delta < -0.005 ? 'text-green border-green' :
    delta >  0.005 ? 'text-red border-red' :
                     'text-text-secondary border-text-secondary';
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
      <span>vs MARKET</span>
      <span className="font-mono text-[12px] text-text">{(market * 100).toFixed(1)}%</span>
      <span className={`border px-1.5 py-0.5 ${cls}`}>
        Δ {(Math.abs(delta) * 100).toFixed(1)}% {dir}
      </span>
    </div>
  );
}
