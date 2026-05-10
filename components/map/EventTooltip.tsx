import type { Event } from '@/lib/types';
import { SourceIcon } from '@/components/ui/SourceIcon';
import { SignificanceDot } from '@/components/ui/SignificanceDot';

function truncate(s: string, n: number) {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}

export function EventTooltip({ event }: { event: Event }) {
  return (
    <div className="min-w-[220px] max-w-[260px] text-text">
      <div className="mb-1.5 flex items-center gap-2">
        <SignificanceDot level={event.significance} />
        <SourceIcon source={event.source_type} label={event.source_author} />
      </div>
      <h4 className="mb-1 text-sm font-semibold leading-snug">{event.title}</h4>
      <p className="text-xs text-text-secondary">{truncate(event.summary, 120)}</p>
      {event.source_url && (
        <a
          href={event.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-accent hover:underline"
        >
          Source ↗
        </a>
      )}
    </div>
  );
}
