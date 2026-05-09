import { formatDistanceToNow, parseISO } from 'date-fns';
import type { Snapshot } from '@/lib/types';
import { SectionHeader } from './SectionHeader';

export function SituationBrief({ snapshot }: { snapshot: Snapshot | null }) {
  if (!snapshot) {
    return (
      <section className="border-b border-border px-4 py-4">
        <SectionHeader>SITUATION BRIEF</SectionHeader>
        <p className="mt-2 text-sm text-text-muted">Awaiting first snapshot.</p>
      </section>
    );
  }

  const fresh = formatDistanceToNow(parseISO(snapshot.created_at), { addSuffix: true }).toUpperCase();
  const developments = snapshot.key_developments ?? [];
  const trendLabel = snapshot.trend?.toUpperCase();

  return (
    <section className="border-b border-border px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader>SITUATION BRIEF</SectionHeader>
        <span
          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-green"
          suppressHydrationWarning
        >
          <span className="dot-pulse inline-block h-1.5 w-1.5 rounded-full bg-green" />
          {fresh}
        </span>
      </div>

      {(trendLabel || snapshot.trend_description) && (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em]">
          {trendLabel && <span className="text-text-muted">TREND <span className="text-text">{trendLabel}</span></span>}
          {snapshot.trend_description && (
            <span className="text-text-secondary normal-case tracking-normal">{snapshot.trend_description}</span>
          )}
        </div>
      )}

      {developments.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {developments.map((dev, i) => (
            <li key={i} className="flex gap-2 font-mono text-[13px] leading-snug text-text">
              <span className="select-none text-green">▸</span>
              <span>{dev}</span>
            </li>
          ))}
        </ul>
      )}

      {/* ai_analysis is intentionally NOT rendered — it duplicates the
          trend_description headline above the bullets. The pipeline still
          writes the field (kept for historic data); the UI just hides it. */}
    </section>
  );
}
