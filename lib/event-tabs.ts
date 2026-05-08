import type { Event, Category, SourceType } from './types';

export type EventTabId = 'all' | 'cases' | 'official' | 'response' | 'science' | 'signal';

export interface TabDef {
  id: EventTabId;
  label: string;
  predicate: (e: Event) => boolean;
}

const isCategory  = (cats: Category[])  => (e: Event) => cats.includes(e.category);
const isSource    = (srcs: SourceType[]) => (e: Event) => srcs.includes(e.source_type);

export const EVENT_TABS: readonly TabDef[] = [
  { id: 'all',      label: 'ALL',      predicate: () => true },
  { id: 'cases',    label: 'CASES',    predicate: isCategory(['case_report', 'death']) },
  { id: 'official', label: 'OFFICIAL', predicate: isSource(['who', 'cdc', 'ecdc', 'africa_cdc']) },
  { id: 'response', label: 'RESPONSE', predicate: isCategory(['containment', 'travel_advisory', 'policy']) },
  { id: 'science',  label: 'SCIENCE',  predicate: isCategory(['research', 'mutation']) },
  { id: 'signal',   label: 'SIGNAL',   predicate: (e) => e.category === 'speculation' || (['x', 'reddit', 'bluesky'] as SourceType[]).includes(e.source_type) },
];

export const EVENT_TAB_BY_ID: Record<EventTabId, TabDef> =
  Object.fromEntries(EVENT_TABS.map((t) => [t.id, t])) as Record<EventTabId, TabDef>;

export function isEventTabId(s: string | null): s is EventTabId {
  return s === 'all' || s === 'cases' || s === 'official'
      || s === 'response' || s === 'science' || s === 'signal';
}
