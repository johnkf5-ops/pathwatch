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

  const headline = snapshot.trend_description ?? 'Outbreak status updated.';
  const fresh = formatDistanceToNow(parseISO(snapshot.created_at), { addSuffix: true }).toUpperCase();

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
      <h3 className="mt-2 font-mono text-[22px] font-bold leading-tight tracking-[-0.01em] text-text">
        {headline}
      </h3>
      {snapshot.ai_analysis && (
        <p className="mt-3 max-w-[60ch] text-[13px] leading-[1.5] text-text-secondary">
          {snapshot.ai_analysis}
        </p>
      )}
    </section>
  );
}
