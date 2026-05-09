'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type {
  Event, Snapshot, CountryStat, Case, CaseLocation, ThreatAssessment, Fact,
} from '@/lib/types';
import { getBrowserClient } from '@/lib/supabase-browser';
import { TopBar } from '@/components/ops/TopBar';
import { SituationBrief } from '@/components/ops/SituationBrief';
import { PostureMatrix } from '@/components/ops/PostureMatrix';
import { Watchlist } from '@/components/ops/Watchlist';
import { TabStrip, type Tab } from '@/components/ops/TabStrip';
import { MapPane } from '@/components/ops/MapPane';
import { ByCountryPane } from '@/components/ops/ByCountryPane';
import { DossierDrawer } from '@/components/ops/DossierDrawer';
import { MonitoringCohort } from '@/components/ops/MonitoringCohort';
import { MobileLayout } from '@/components/ops/MobileLayout';
import { EventFeed } from '@/components/feed/EventFeed';
import { ThreatPanelExpanded } from '@/components/threat/ThreatPanelExpanded';
import { KpiHud } from '@/components/ops/KpiHud';
import { VirusProfile } from '@/components/profile/VirusProfile';

interface Props {
  initialSnapshot: Snapshot | null;
  initialSnapshotHistory: Snapshot[];
  initialEvents: Event[];
  initialCountries: CountryStat[];
  initialCases: Case[];
  initialCaseLocations: CaseLocation[];
  initialThreat: ThreatAssessment | null;
  initialFacts: Fact[];
}

export function DashboardClient({
  initialSnapshot,
  initialSnapshotHistory,
  initialEvents,
  initialCountries,
  initialCases,
  initialCaseLocations,
  initialThreat,
  initialFacts,
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
  const [threat, setThreat] = useState(initialThreat);
  const [facts, setFacts] = useState(initialFacts);
  const [activeTab, setActiveTab] = useState<'map' | 'country'>('map');

  useEffect(() => { setSnapshot(initialSnapshot); }, [initialSnapshot]);
  useEffect(() => { setSnapshotHistory(initialSnapshotHistory); }, [initialSnapshotHistory]);
  useEffect(() => { setEvents(initialEvents); }, [initialEvents]);
  useEffect(() => { setCountries(initialCountries); }, [initialCountries]);
  useEffect(() => { setCases(initialCases); }, [initialCases]);
  useEffect(() => { setCaseLocations(initialCaseLocations); }, [initialCaseLocations]);
  useEffect(() => { setThreat(initialThreat); }, [initialThreat]);
  useEffect(() => { setFacts(initialFacts); }, [initialFacts]);

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

    const ch6 = supabase
      .channel('threat-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'threat_assessments', filter: 'disease=eq.hantavirus' },
        (p) => setThreat(p.new as ThreatAssessment),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      supabase.removeChannel(ch3);
      supabase.removeChannel(ch4);
      supabase.removeChannel(ch5);
      supabase.removeChannel(ch6);
    };
  }, []);

  const prevSnapshot = snapshotHistory.length >= 2 ? snapshotHistory[snapshotHistory.length - 2] : null;
  const selectedCaseId = caseCode ? cases.find((c) => c.case_code === caseCode)?.id ?? null : null;

  const activeCases = cases.filter((c) => c.status !== 'monitoring');
  const monitoringCases = cases.filter((c) => c.status === 'monitoring');

  const tabs: Tab[] = [
    { id: 'map', label: 'MAP', count: activeCases.length },
    { id: 'country', label: 'BY COUNTRY', count: countries.length },
  ];

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:min-h-0">
      <TopBar snapshot={snapshot} threat={threat} />

      {/* Mobile (< lg): single-column stack with collapsible map + bottom sheet */}
      <div className="lg:hidden">
        <MobileLayout
          snapshot={snapshot}
          prevSnapshot={prevSnapshot}
          events={events}
          countries={countries}
          cases={cases}
          caseLocations={caseLocations}
          threat={threat}
          facts={facts}
          monitoringCases={monitoringCases}
          selectedCaseId={selectedCaseId}
          caseCode={caseCode}
        />
      </div>

      {/* Desktop (lg+): three-column flight deck — left context · center map · right lists · bottom event feed */}
      <div
        data-testid="desktop-layout"
        className="hidden flex-1 lg:grid lg:min-h-0 lg:grid-cols-[300px_1fr_300px] lg:grid-rows-[1fr_180px]"
      >
        {/* Left: narrative context */}
        <div className="overflow-y-auto border-r border-border">
          <SituationBrief snapshot={snapshot} />
          {threat && <ThreatPanelExpanded assessment={threat} />}
          <VirusProfile facts={facts} />
        </div>

        {/* Center: map workspace with KPI HUD overlay */}
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
                <KpiHud snapshot={snapshot} prevSnapshot={prevSnapshot} cases={cases} />
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

        {/* Right: situational lists */}
        <div className="overflow-y-auto border-l border-border">
          <Watchlist events={events} />
          <MonitoringCohort cases={monitoringCases} />
          <PostureMatrix countries={countries} />
        </div>

        {/* Bottom: event feed strip spanning all three columns */}
        <div className="col-span-3 overflow-y-auto border-t border-border">
          <EventFeed events={events} />
        </div>
      </div>
    </div>
  );
}
