import type { Case, CaseLocation, CaseStatus } from './types';

export const STATUS_COLOR: Record<CaseStatus, string> = {
  suspected: '#4cd6ff',
  confirmed: '#f5b041',
  critical: '#ff7f3f',
  deceased: '#ff4d5e',
  recovered: '#2ee37a',
};

export const STATUS_LABEL: Record<CaseStatus, string> = {
  suspected: 'SUSPECTED',
  confirmed: 'CONFIRMED',
  critical: 'CRITICAL',
  deceased: 'DECEASED',
  recovered: 'RECOVERED',
};

export function caseLocationsFor(caseId: string, all: CaseLocation[]): CaseLocation[] {
  return all
    .filter((l) => l.case_id === caseId)
    .sort((a, b) => new Date(a.arrived_at).getTime() - new Date(b.arrived_at).getTime());
}

export function currentLocation(stops: CaseLocation[]): CaseLocation | null {
  if (stops.length === 0) return null;
  const open = stops.filter((s) => !s.departed_at);
  if (open.length > 0) {
    return [...open].sort(
      (a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime(),
    )[0];
  }
  return [...stops].sort(
    (a, b) => new Date(b.arrived_at).getTime() - new Date(a.arrived_at).getTime(),
  )[0];
}

export function casesByCountry(
  countryCode: string,
  cases: Case[],
): Case[] {
  return cases.filter(
    (c) => c.current_country === countryCode || c.exposure_country === countryCode,
  );
}
