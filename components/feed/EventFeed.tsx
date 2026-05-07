'use client';
import type { Event } from '@/lib/types';
import { EventCard } from './EventCard';

export function EventFeed({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-text-secondary">
        No intelligence events match these filters.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {events.map((e) => (
        <EventCard key={e.id} event={e} />
      ))}
    </div>
  );
}
