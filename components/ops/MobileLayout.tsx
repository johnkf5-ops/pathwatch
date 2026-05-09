'use client';
import type {
  Event, Snapshot, CountryStat, Case, CaseLocation, ThreatAssessment, Fact,
} from '@/lib/types';
import { SituationBrief } from './SituationBrief';
import { KpiGrid } from './KpiGrid';
import { PostureMatrix } from './PostureMatrix';
import { Watchlist } from './Watchlist';
import { MonitoringCohort } from './MonitoringCohort';
import { MapWithToggle } from './MapWithToggle';
import { VirusProfile } from '@/components/profile/VirusProfile';
import { EventFeed } from '@/components/feed/EventFeed';
import { ThreatBanner } from '@/components/threat/ThreatBanner';
import { CaseDossierSheet } from '@/components/case/CaseDossierSheet';

interface Props {
  snapshot: Snapshot | null;
  prevSnapshot: Snapshot | null;
  events: Event[];
  countries: CountryStat[];
  cases: Case[];
  caseLocations: CaseLocation[];
  threat: ThreatAssessment | null;
  facts: Fact[];
  monitoringCases: Case[];
  selectedCaseId: string | null;
  caseCode: string | null;
}

export function MobileLayout({
  snapshot,
  prevSnapshot,
  events,
  countries,
  cases,
  caseLocations,
  threat,
  facts,
  monitoringCases,
  selectedCaseId,
  caseCode,
}: Props) {
  return (
    <div data-testid="mobile-layout" className="flex flex-col">
      {threat && <ThreatBanner assessment={threat} />}
      <MapWithToggle
        countries={countries}
        cases={cases}
        caseLocations={caseLocations}
        selectedCaseId={selectedCaseId}
      />
      <SituationBrief snapshot={snapshot} />
      <KpiGrid snapshot={snapshot} prevSnapshot={prevSnapshot} />
      <PostureMatrix countries={countries} />
      <Watchlist events={events} />
      <MonitoringCohort cases={monitoringCases} />
      <VirusProfile facts={facts} />
      <EventFeed events={events} />
      <CaseDossierSheet
        cases={cases}
        caseLocations={caseLocations}
        events={events}
        caseCode={caseCode}
      />
    </div>
  );
}
