'use client';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import type { Event } from '@/lib/types';
import { SectionHeader } from '@/components/ops/SectionHeader';
import { EVENT_TAB_BY_ID, isEventTabId, type EventTabId } from '@/lib/event-tabs';
import { EventTabBar } from './EventTabBar';
import { EventCard } from './EventCard';

export function EventFeed({ events }: { events: Event[] }) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const active: EventTabId = isEventTabId(tabParam) ? tabParam : 'all';

  const filtered = useMemo(() => {
    const predicate = EVENT_TAB_BY_ID[active].predicate;
    // Sort by occurred_at when available (when the event actually happened),
    // falling back to created_at (when we wrote the row). Matches the card's
    // 'X hours ago' label which uses the same precedence.
    const ts = (e: Event) => new Date(e.occurred_at ?? e.created_at).getTime();
    return events.filter(predicate).sort((a, b) => ts(b) - ts(a));
  }, [events, active]);

  return (
    <section className="border-t border-border px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <SectionHeader>
          INTELLIGENCE FEED
          <span className="ml-2 font-mono text-[10px] tracking-[0.1em] text-text-muted">
            {filtered.length} OF {events.length}
          </span>
        </SectionHeader>
        <EventTabBar events={events} active={active} />
      </div>

      {active === 'signal' && (
        <div className="mb-3 flex items-center gap-2 border border-amber/40 bg-amber/5 px-3 py-2 font-mono text-[11px] text-amber">
          <AlertTriangle size={12} />
          <span className="uppercase tracking-[0.12em]">UNVERIFIED SOCIAL MEDIA SIGNAL</span>
          <span className="ml-1 normal-case tracking-normal text-text-secondary">
            — speculation and rumor; corroborate before acting.
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="border border-dashed border-border p-6 text-center text-sm text-text-muted">
          No events in this view.
        </p>
      ) : (
        <div className="event-ticker -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
          {filtered.map((e) => (
            <div key={e.id} className="w-[320px] shrink-0">
              <EventCard event={e} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
