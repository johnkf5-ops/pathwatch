'use client';
import { useEffect, useState } from 'react';
import type { Event, Snapshot, CountryStat, FilterState } from '@/lib/types';
import { eventMatchesFilter } from '@/lib/filters';
import { getBrowserClient } from '@/lib/supabase-browser';
import { SituationOverview } from '@/components/overview/SituationOverview';
import { FilterBar } from '@/components/feed/FilterBar';
import { EventFeed } from '@/components/feed/EventFeed';
import { CountryBreakdown } from '@/components/country/CountryBreakdown';

interface Props {
  initialSnapshot: Snapshot | null;
  initialEvents: Event[];
  initialCountries: CountryStat[];
  initialFilters: FilterState;
}

export function DashboardClient({
  initialSnapshot,
  initialEvents,
  initialCountries,
  initialFilters,
}: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [events, setEvents] = useState(initialEvents);
  const [countries, setCountries] = useState(initialCountries);
  const [connected, setConnected] = useState(true);

  useEffect(() => { setSnapshot(initialSnapshot); }, [initialSnapshot]);
  useEffect(() => { setEvents(initialEvents); }, [initialEvents]);
  useEffect(() => { setCountries(initialCountries); }, [initialCountries]);

  useEffect(() => {
    const supabase = getBrowserClient();

    const eventsChannel = supabase
      .channel('events-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events', filter: 'disease=eq.hantavirus' },
        (payload) => {
          const ev = payload.new as Event;
          if (ev.duplicate_of) return;
          if (!eventMatchesFilter(ev, initialFilters)) return;
          setEvents((prev) => (prev.find((e) => e.id === ev.id) ? prev : [ev, ...prev]));
        },
      )
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'));

    const snapshotChannel = supabase
      .channel('snapshots-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'snapshots', filter: 'disease=eq.hantavirus' },
        (payload) => setSnapshot(payload.new as Snapshot),
      )
      .subscribe();

    const countriesChannel = supabase
      .channel('country-stats-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'country_stats', filter: 'disease=eq.hantavirus' },
        (payload) => {
          const row = (payload.new ?? payload.old) as CountryStat;
          setCountries((prev) => {
            const next = prev.filter((r) => r.country_code !== row.country_code);
            if (payload.eventType !== 'DELETE') next.push(row);
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(snapshotChannel);
      supabase.removeChannel(countriesChannel);
    };
  }, [initialFilters]);

  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-6">
      {!connected && (
        <div className="rounded-md border border-sig-3/40 bg-sig-3/10 px-3 py-2 text-xs text-sig-3">
          Live connection lost. Showing last known data.
        </div>
      )}
      <SituationOverview snapshot={snapshot} />
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,440px)]">
        <div>
          <FilterBar filters={initialFilters} />
          <EventFeed events={events} />
        </div>
        <aside>
          <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-muted">
            Map and charts arrive in sub-project 2b.
          </div>
        </aside>
      </div>
      <CountryBreakdown rows={countries} />
    </main>
  );
}
