'use client';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/Skeleton';
import type { CountryStat, Case, CaseLocation } from '@/lib/types';

const MapPanel = dynamic(
  () => import('@/components/map/MapPanel').then((m) => m.MapPanel),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full" />,
  },
);

export function MapPane({
  countries,
  cases,
  caseLocations,
  selectedCaseId,
}: {
  countries: CountryStat[];
  cases: Case[];
  caseLocations: CaseLocation[];
  selectedCaseId: string | null;
}) {
  return (
    <div className="absolute inset-0">
      <MapPanel
        countries={countries}
        cases={cases}
        caseLocations={caseLocations}
        selectedCaseId={selectedCaseId}
      />
    </div>
  );
}
