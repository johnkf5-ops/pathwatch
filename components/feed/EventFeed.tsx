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
    return events
      .filter(predicate)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </section>
  );
}
