import type { Case, CaseClass, CaseLocation, CaseStatus } from './types';

export const STATUS_COLOR: Record<CaseStatus, string> = {
  monitoring: '#4cd6ff',
  suspected: '#8a93a8',
  confirmed: '#f5b041',
  critical: '#ff7f3f',
  deceased: '#ff4d5e',
  recovered: '#2ee37a',
};

export function statusRgb(status: CaseStatus): [number, number, number] {
  const hex = STATUS_COLOR[status].replace('#', '');
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

export const STATUS_LABEL: Record<CaseStatus, string> = {
  monitoring: 'MONITORING',
  suspected: 'SUSPECTED',
  confirmed: 'CONFIRMED',
  critical: 'CRITICAL',
  deceased: 'DECEASED',
  recovered: 'RECOVERED',
};

const ACTIVE_STATUSES: CaseStatus[] = ['suspected', 'confirmed', 'critical', 'deceased', 'recovered'];

export function isMonitoringCase(c: { status: CaseStatus }): boolean {
  return c.status === 'monitoring';
}

export function isActiveCase(c: { status: CaseStatus }): boolean {
  return ACTIVE_STATUSES.includes(c.status);
}

export interface ClearanceState {
  daysRemaining: number;          // negative if cleared
  totalWindowDays: number | null; // null when exposure_date is missing
  cleared: boolean;
  tone: 'green' | 'amber' | 'orange' | 'red' | 'cleared';
}

export function clearanceFor(
  clearanceDate: string | null,
  exposureDate: string | null,
  today: Date = new Date(),
): ClearanceState | null {
  if (!clearanceDate) return null;
  const t0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const c = new Date(clearanceDate + 'T00:00:00Z');
  const daysRemaining = Math.ceil((c.getTime() - t0) / 86_400_000);
  const cleared = daysRemaining <= 0;
  const totalWindowDays = exposureDate
    ? Math.round((c.getTime() - new Date(exposureDate + 'T00:00:00Z').getTime()) / 86_400_000)
    : null;
  let tone: ClearanceState['tone'];
  if (cleared) tone = 'cleared';
  else if (daysRemaining > 30) tone = 'green';
  else if (daysRemaining >= 7)  tone = 'amber';
  else if (daysRemaining >= 1)  tone = 'orange';
  else tone = 'red';
  return { daysRemaining, totalWindowDays, cleared, tone };
}

export function caseLabel(c: Pick<Case, 'display_name' | 'case_code'>): string {
  return c.display_name ?? c.case_code;
}

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

export const CASE_CLASS_LABEL: Record<CaseClass, string> = {
  confirmed_case: 'CONFIRMED',
  probable_case: 'PROBABLE',
  suspected_case: 'SUSPECTED',
  contact: 'CONTACT',
  returnee: 'RETURNEE',
};

export const CASE_CLASSES_AS_CASES: readonly CaseClass[] = [
  'confirmed_case',
  'probable_case',
  'suspected_case',
];

export function isCase(c: { case_class: CaseClass }): boolean {
  return CASE_CLASSES_AS_CASES.includes(c.case_class);
}

export function isContact(c: { case_class: CaseClass }): boolean {
  return c.case_class === 'contact' || c.case_class === 'returnee';
}
