'use client';
import { useMediaQuery } from '@/lib/use-media-query';
import type {
  Event, Snapshot, CountryStat, Case, CaseLocation, ThreatAssessment, Fact,
  OutbreakTimelineEntry,
} from '@/lib/types';
import { SituationBrief } from './SituationBrief';
import { OutbreakTimeline } from './OutbreakTimeline';
import { KpiGrid } from './KpiGrid';
import { PostureMatrix } from './PostureMatrix';
import { Watchlist } from './Watchlist';
import { MonitoringCohort } from './MonitoringCohort';
import { MapWithToggle } from './MapWithToggle';
import { VirusProfile } from '@/components/profile/VirusProfile';
import { EventFeed } from '@/components/feed/EventFeed';
import { ThreatPanelExpanded } from '@/components/threat/ThreatPanelExpanded';
import { CaseDossierSheet } from '@/components/case/CaseDossierSheet';
import { isCase, isContact, sumPersons } from '@/lib/case-helpers';

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
  timeline: OutbreakTimelineEntry[];
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
  timeline,
}: Props) {
  // Only mount the vaul-based bottom sheet when the viewport is actually
  // mobile. lg:hidden alone doesn't prevent the React component from
  // mounting — and when its open, Radix DismissableLayer (used by vaul)
  // sets `body.style.pointerEvents = 'none'`, which blocks clicks on the
  // desktop dashboard. Mounting the sheet only on mobile prevents that
  // body-level lock from ever applying on desktop.
  const isMobileViewport = useMediaQuery('(max-width: 1023.98px)', false);
  const caseRows = cases.filter(isCase);
  const contactRows = cases.filter(isContact);

  return (
    <div data-testid="mobile-layout" className="flex flex-col">
      <MapWithToggle
        countries={countries}
        cases={cases}
        caseLocations={caseLocations}
        selectedCaseId={selectedCaseId}
        caseCount={sumPersons(caseRows)}
        contactCount={sumPersons(contactRows)}
      />
      <SituationBrief snapshot={snapshot} />
      <OutbreakTimeline entries={timeline} />
      <KpiGrid snapshot={snapshot} prevSnapshot={prevSnapshot} cases={cases} />
      {threat && <ThreatPanelExpanded assessment={threat} />}
      <Watchlist events={events} />
      <MonitoringCohort cases={monitoringCases} />
      <PostureMatrix countries={countries} />
      <VirusProfile facts={facts} />
      <EventFeed events={events} />
      {isMobileViewport && (
        <CaseDossierSheet
          cases={cases}
          caseLocations={caseLocations}
          events={events}
          caseCode={caseCode}
        />
      )}
    </div>
  );
}
