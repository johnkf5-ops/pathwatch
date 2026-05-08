'use client';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Event, Significance, SourceType, Category } from '@/lib/types';
import { SectionHeader } from '@/components/ops/SectionHeader';
import { FilterBar } from './FilterBar';
import { EventCard } from './EventCard';

export function EventFeed({ events }: { events: Event[] }) {
  const searchParams = useSearchParams();
  const sig = searchParams.get('sig');
  const source = searchParams.get('source') as SourceType | null;
  const category = searchParams.get('category') as Category | null;

  const filtered = useMemo(() => {
    const sigNum = sig ? (Number(sig) as Significance) : null;
    return events
      .filter((e) => {
        if (sigNum && e.significance < sigNum) return false;
        if (source && e.source_type !== source) return false;
        if (category && e.category !== category) return false;
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [events, sig, source, category]);

  return (
    <section className="border-t border-border px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <SectionHeader>
          INTELLIGENCE FEED
          <span className="ml-2 font-mono text-[10px] tracking-[0.1em] text-text-muted">
            {filtered.length} OF {events.length}
          </span>
        </SectionHeader>
        <FilterBar />
      </div>
      {filtered.length === 0 ? (
        <p className="border border-dashed border-border p-6 text-center text-sm text-text-muted">
          No events match these filters.
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
