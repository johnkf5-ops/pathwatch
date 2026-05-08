'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Event, Snapshot, CountryStat, Case, CaseLocation } from '@/lib/types';
import { getBrowserClient } from '@/lib/supabase-browser';
import { TopBar } from '@/components/ops/TopBar';
import { SituationBrief } from '@/components/ops/SituationBrief';
import { KpiGrid } from '@/components/ops/KpiGrid';
import { PostureMatrix } from '@/components/ops/PostureMatrix';
import { Watchlist } from '@/components/ops/Watchlist';
import { TabStrip, type Tab } from '@/components/ops/TabStrip';
import { MapPane } from '@/components/ops/MapPane';
import { ByCountryPane } from '@/components/ops/ByCountryPane';
import { DossierDrawer } from '@/components/ops/DossierDrawer';
import { EventFeed } from '@/components/feed/EventFeed';

interface Props {
  initialSnapshot: Snapshot | null;
  initialSnapshotHistory: Snapshot[];
  initialEvents: Event[];
  initialCountries: CountryStat[];
  initialCases: Case[];
  initialCaseLocations: CaseLocation[];
}

export function DashboardClient({
  initialSnapshot,
  initialSnapshotHistory,
  initialEvents,
  initialCountries,
  initialCases,
  initialCaseLocations,
}: Props) {
  const searchParams = useSearchParams();
  const caseCode = searchParams.get('case');
  const countryCode = searchParams.get('country');

  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [snapshotHistory, setSnapshotHistory] = useState(initialSnapshotHistory);
  const [events, setEvents] = useState(initialEvents);
  const [countries, setCountries] = useState(initialCountries);
  const [cases, setCases] = useState(initialCases);
  const [caseLocations, setCaseLocations] = useState(initialCaseLocations);
  const [activeTab, setActiveTab] = useState<'map' | 'country'>('map');

  useEffect(() => { setSnapshot(initialSnapshot); }, [initialSnapshot]);
  useEffect(() => { setSnapshotHistory(initialSnapshotHistory); }, [initialSnapshotHistory]);
  useEffect(() => { setEvents(initialEvents); }, [initialEvents]);
  useEffect(() => { setCountries(initialCountries); }, [initialCountries]);
  useEffect(() => { setCases(initialCases); }, [initialCases]);
  useEffect(() => { setCaseLocations(initialCaseLocations); }, [initialCaseLocations]);

  useEffect(() => {
    const supabase = getBrowserClient();

    const ch1 = supabase
      .channel('events-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events', filter: 'disease=eq.hantavirus' },
        (p) => {
          const ev = p.new as Event;
          if (ev.duplicate_of) return;
          setEvents((prev) => (prev.find((e) => e.id === ev.id) ? prev : [ev, ...prev]));
        },
      )
      .subscribe();

    const ch2 = supabase
      .channel('snapshots-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'snapshots', filter: 'disease=eq.hantavirus' },
        (p) => {
          const s = p.new as Snapshot;
          setSnapshot(s);
          setSnapshotHistory((prev) => (prev.find((x) => x.id === s.id) ? prev : [...prev, s].slice(-30)));
        },
      )
      .subscribe();

    const ch3 = supabase
      .channel('country-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'country_stats', filter: 'disease=eq.hantavirus' },
        (p) => {
          const row = (p.new ?? p.old) as CountryStat;
          setCountries((prev) => {
            const next = prev.filter((r) => r.country_code !== row.country_code);
            if (p.eventType !== 'DELETE') next.push(row);
            return next;
          });
        },
      )
      .subscribe();

    const ch4 = supabase
      .channel('cases-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cases', filter: 'disease=eq.hantavirus' },
        (p) => {
          const row = (p.new ?? p.old) as Case;
          setCases((prev) => {
            const next = prev.filter((c) => c.id !== row.id);
            if (p.eventType !== 'DELETE') next.push(row);
            return next;
          });
        },
      )
      .subscribe();

    const ch5 = supabase
      .channel('case-loc-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'case_locations' },
        (p) => {
          const row = p.new as CaseLocation;
          setCaseLocations((prev) => (prev.find((l) => l.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      supabase.removeChannel(ch3);
      supabase.removeChannel(ch4);
      supabase.removeChannel(ch5);
    };
  }, []);

  const prevSnapshot = snapshotHistory.length >= 2 ? snapshotHistory[snapshotHistory.length - 2] : null;
  const selectedCaseId = caseCode ? cases.find((c) => c.case_code === caseCode)?.id ?? null : null;

  const tabs: Tab[] = [
    { id: 'map', label: 'MAP', count: cases.length },
    { id: 'country', label: 'BY COUNTRY', count: countries.length },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar snapshot={snapshot} />
      <div className="grid h-[calc(100vh-2rem)] lg:grid-cols-2">
        {/* Sit-rep (left) */}
        <div className="overflow-y-auto border-b border-border lg:border-b-0 lg:border-r">
          <SituationBrief snapshot={snapshot} />
          <KpiGrid snapshot={snapshot} prevSnapshot={prevSnapshot} />
          <PostureMatrix countries={countries} />
          <Watchlist events={events} />
        </div>

        {/* Workspace (right) */}
        <div className="relative flex flex-col overflow-hidden">
          <TabStrip tabs={tabs} active={activeTab} onChange={(id) => setActiveTab(id as 'map' | 'country')} />
          <div className="relative flex-1">
            {activeTab === 'map' && (
              <>
                <MapPane
                  countries={countries}
                  cases={cases}
                  caseLocations={caseLocations}
                  selectedCaseId={selectedCaseId}
                />
                <DossierDrawer
                  cases={cases}
                  caseLocations={caseLocations}
                  countries={countries}
                  events={events}
                  caseCode={caseCode}
                  countryCode={countryCode}
                />
              </>
            )}
            {activeTab === 'country' && <ByCountryPane rows={countries} />}
          </div>
        </div>
      </div>

      {/* Full-width intelligence feed below the grid */}
      <EventFeed events={events} />
    </div>
  );
}
