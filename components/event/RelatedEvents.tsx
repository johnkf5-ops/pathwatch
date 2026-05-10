import Link from 'next/link';
import type { Event } from '@/lib/types';
import { SignificanceDot } from '@/components/ui/SignificanceDot';
import { SourceIcon } from '@/components/ui/SourceIcon';
import { TimeAgo } from '@/components/ui/TimeAgo';

export function RelatedEvents({ events }: { events: Event[] }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-text">Related events</h2>
      {events.length === 0 ? (
        <p className="text-xs text-text-muted">No related events yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/event/${e.id}`} className="block hover:bg-surface-hover -mx-2 rounded-md p-2">
                <div className="mb-1 flex items-center gap-2">
                  <SignificanceDot level={e.significance} />
                  <SourceIcon source={e.source_type} label={e.source_author} />
                  <TimeAgo iso={e.occurred_at ?? e.created_at} />
                </div>
                <p className="text-sm leading-snug text-text line-clamp-2">{e.title}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
