import Link from 'next/link';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import type { Event } from '@/lib/types';

const SOURCE_LABEL: Record<Event['source_type'], string> = {
  who: 'WHO',
  cdc: 'CDC',
  ecdc: 'ECDC',
  africa_cdc: 'AFRICA CDC',
  google_news: 'GOOGLE',
  reddit: 'REDDIT',
  x: 'X',
  bluesky: 'BLUESKY',
  wikipedia: 'WIKI',
};

function tagFor(sig: Event['significance']): { text: string; cls: string } | null {
  if (sig === 5) return { text: 'ALERT', cls: 'border-red text-red' };
  if (sig === 4) return { text: 'WATCH', cls: 'border-orange text-orange' };
  return null;
}

export function WatchlistItem({ event }: { event: Event }) {
  const tag = tagFor(event.significance);
  const age = formatDistanceToNowStrict(parseISO(event.occurred_at ?? event.created_at)).toUpperCase();
  return (
    <li>
      <Link href={`/event/${event.id}`} className="block border-b border-border-soft py-2 last:border-0 hover:bg-surface-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em]">
          <span className="text-text-muted">{age}</span>
          <span className="text-text-secondary">{SOURCE_LABEL[event.source_type]}</span>
          {tag && <span className={`ml-auto border px-1.5 py-0.5 ${tag.cls}`}>{tag.text}</span>}
        </div>
        <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-text">{event.title}</p>
      </Link>
    </li>
  );
}
