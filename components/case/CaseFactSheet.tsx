import { ArrowUpRight } from 'lucide-react';
import type { Case, CaseLocation } from '@/lib/types';
import { caseLocationsFor, caseLabel } from '@/lib/case-helpers';
import { CaseStatusPill } from './CaseStatusPill';
import { SectionHeader } from '@/components/ops/SectionHeader';

/**
 * Compact case fact sheet — designed to fit in the dossier drawer without
 * needing scroll. Pairs with a "MORE INFO" button that opens
 * CaseDossierModal with the full content scrollable inside the popup.
 */
export function CaseFactSheet({
  case_,
  locations,
  onMoreInfo,
}: {
  case_: Case;
  locations: CaseLocation[];
  onMoreInfo: () => void;
}) {
  const stops = caseLocationsFor(case_.id, locations);
  const meta = [case_.role?.toUpperCase().replace('_', ' '), case_.age_range, case_.sex]
    .filter(Boolean)
    .join(' · ');

  const firstStop = stops[0];
  const lastStop = stops[stops.length - 1];

  return (
    <article className="flex flex-col gap-3 p-4">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-mono text-[18px] font-bold leading-tight tracking-[-0.01em] text-text">
            {caseLabel(case_)}
          </h1>
          <CaseStatusPill status={case_.status} />
        </div>
        {case_.display_name && (
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
            {case_.case_code}
          </div>
        )}
        {meta && (
          <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-text-muted">
            {meta}{case_.is_index_case ? ' · INDEX CASE' : ''}
          </div>
        )}
      </header>

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

      {case_.dossier && (
        <section>
          <SectionHeader>DOSSIER</SectionHeader>
          <p className="mt-2 line-clamp-4 text-[13px] leading-snug text-text-secondary">
            {case_.dossier}
          </p>
        </section>
      )}

      {stops.length > 0 && (
        <section>
          <SectionHeader>TRAVEL</SectionHeader>
          <div className="mt-2 font-mono text-[11.5px] text-text-secondary">
            <span className="text-text-muted">{stops.length} STOP{stops.length === 1 ? '' : 'S'}</span>
            {firstStop?.location_name && (
              <span> · {firstStop.location_name}</span>
            )}
            {lastStop && lastStop !== firstStop && lastStop.location_name && (
              <span> → {lastStop.location_name}</span>
            )}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={onMoreInfo}
        className="mt-2 inline-flex items-center justify-center gap-1.5 border border-accent bg-accent/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent transition-colors hover:bg-accent/20"
      >
        MORE INFO
        <ArrowUpRight size={12} />
      </button>
    </article>
  );
}
