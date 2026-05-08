import Link from 'next/link';
import type { Case, CaseLocation, Event } from '@/lib/types';
import { caseLocationsFor } from '@/lib/case-helpers';
import { CaseStatusPill } from './CaseStatusPill';
import { TravelTimeline } from './TravelTimeline';
import { SectionHeader } from '@/components/ops/SectionHeader';

export function CaseDossier({
  case_,
  locations,
  sourceEvent,
  showOpenLink = false,
}: {
  case_: Case;
  locations: CaseLocation[];
  sourceEvent?: Event | null;
  showOpenLink?: boolean;
}) {
  const stops = caseLocationsFor(case_.id, locations);
  const meta = [case_.role?.toUpperCase().replace('_', ' '), case_.age_range, case_.sex]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="flex flex-col gap-4 p-4">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-mono text-[22px] font-bold leading-tight tracking-[-0.01em] text-text">
            {case_.case_code}
          </h1>
          <CaseStatusPill status={case_.status} />
        </div>
        {meta && (
          <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-muted">
            {meta}{case_.is_index_case ? ' · INDEX CASE' : ''}
          </div>
        )}
      </header>

      {case_.dossier && (
        <section>
          <SectionHeader>DOSSIER</SectionHeader>
          <p className="mt-2 text-sm leading-[1.55] text-text-secondary">{case_.dossier}</p>
        </section>
      )}

      <section>
        <SectionHeader>KEY DATES</SectionHeader>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11.5px]">
          <dt className="text-text-muted">EXPOSURE</dt>
          <dd className="tabular-nums text-text">{case_.exposure_date ?? '—'}</dd>
          <dt className="text-text-muted">ONSET</dt>
          <dd className="tabular-nums text-text">{case_.onset_date ?? '—'}</dd>
          <dt className="text-text-muted">CONFIRMED</dt>
          <dd className="tabular-nums text-text">{case_.confirmed_date ?? '—'}</dd>
          <dt className="text-text-muted">OUTCOME</dt>
          <dd className="tabular-nums text-text">{case_.outcome_date ?? '—'}</dd>
        </dl>
      </section>

      <section>
        <SectionHeader>TRAVEL TIMELINE</SectionHeader>
        <div className="mt-3"><TravelTimeline stops={stops} /></div>
      </section>

      {sourceEvent && (
        <section>
          <SectionHeader>LINKED EVENT</SectionHeader>
          <Link
            href={`/event/${sourceEvent.id}`}
            className="mt-2 block text-sm leading-snug text-accent hover:underline"
          >
            {sourceEvent.title} ↗
          </Link>
        </section>
      )}

      {showOpenLink && (
        <Link
          href={`/case/${case_.case_code}`}
          className="self-start font-mono text-[10.5px] uppercase tracking-[0.1em] text-accent hover:underline"
        >
          OPEN PERMALINK ↗
        </Link>
      )}
    </article>
  );
}
