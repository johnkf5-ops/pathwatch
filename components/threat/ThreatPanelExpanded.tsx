import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import type { ThreatAssessment } from '@/lib/types';
import { SignalIndicators } from './SignalIndicators';

function pct(v: number | null) {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`;
}

export function ThreatPanelExpanded({ assessment: a }: { assessment: ThreatAssessment }) {
  const age = formatDistanceToNowStrict(parseISO(a.created_at)).toUpperCase();
  return (
    <section
      className="space-y-4 border-t border-border bg-bg px-4 py-4"
      aria-labelledby="threat-assessment-heading"
    >
      <h2 id="threat-assessment-heading" className="sr-only">
        Pandemic Threat Assessment
      </h2>
      <div className="space-y-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
          ASSESSMENT · <span suppressHydrationWarning>{age} AGO</span> · MODEL {a.model}
        </div>
        <p className="text-[13px] leading-snug text-text">{a.summary}</p>
        <p className="text-[12px] leading-relaxed text-text-secondary">{a.reasoning}</p>
      </div>

      <div>
        <h3 className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">KEY SIGNALS</h3>
        <SignalIndicators assessment={a} />
      </div>

      <div>
        <h3 className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">POLYMARKET</h3>
        <dl className="grid grid-cols-[1fr_auto] gap-y-0.5 font-mono text-[11px]">
          <dt className="text-text-muted">Pandemic 2026</dt>
          <dd className="text-right text-text">{pct(a.polymarket_pandemic_odds)}</dd>
          <dt className="text-text-muted">US case by May 15</dt>
          <dd className="text-right text-text">{pct(a.polymarket_us_case_odds)}</dd>
          <dt className="text-text-muted">Vaccine 2026</dt>
          <dd className="text-right text-text">{pct(a.polymarket_vaccine_odds)}</dd>
          <dt className="text-text-muted">Lab leak by Jun 30</dt>
          <dd className="text-right text-text">{pct(a.polymarket_lab_leak_odds)}</dd>
        </dl>
        {a.ai_vs_market_note && (
          <p className="mt-2 text-[11.5px] leading-snug text-text-secondary">{a.ai_vs_market_note}</p>
        )}
      </div>
    </section>
  );
}
