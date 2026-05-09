'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import Link from 'next/link';
import type { Case, CaseLocation, CountryStat, Event } from '@/lib/types';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { CaseStatusPill } from '@/components/case/CaseStatusPill';
import { CaseFactSheet } from '@/components/case/CaseFactSheet';
import { CaseDossierModal } from '@/components/case/CaseDossierModal';
import { SectionHeader } from './SectionHeader';
import { casesByCountry, caseLabel } from '@/lib/case-helpers';

export function DossierDrawer({
  cases,
  caseLocations,
  countries,
  events,
  caseCode,
  countryCode,
}: {
  cases: Case[];
  caseLocations: CaseLocation[];
  countries: CountryStat[];
  events: Event[];
  caseCode: string | null;
  countryCode: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const open = caseCode != null || countryCode != null;
  const [showFull, setShowFull] = useState(false);

  // If the selected case changes, close any open full-dossier modal
  useEffect(() => {
    setShowFull(false);
  }, [caseCode]);

  function close() {
    const u = new URLSearchParams(searchParams.toString());
    u.delete('case');
    u.delete('country');
    const qs = u.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  let body: React.ReactNode = null;
  const selectedCase = caseCode ? cases.find((x) => x.case_code === caseCode) ?? null : null;
  const selectedSourceEvent = selectedCase?.source_event_id
    ? events.find((e) => e.id === selectedCase.source_event_id) ?? null
    : null;

  if (caseCode) {
    if (selectedCase) {
      body = <CaseFactSheet case_={selectedCase} locations={caseLocations} onMoreInfo={() => setShowFull(true)} />;
    } else {
      body = <p className="p-4 text-sm text-text-muted">Case {caseCode} not found.</p>;
    }
  } else if (countryCode) {
    const country = countries.find((c) => c.country_code === countryCode);
    const list = casesByCountry(countryCode, cases);
    body = (
      <div className="flex flex-col gap-4 p-4">
        <header className="flex items-center gap-2">
          <CountryFlag code={countryCode} className="text-2xl" />
          <h1 className="font-mono text-[22px] font-bold leading-tight text-text">
            {country?.country_name ?? countryCode}
          </h1>
        </header>
        {country && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11.5px]">
            <dt className="text-text-muted">CASES</dt>
            <dd className="tabular-nums text-text">{country.cases}</dd>
            <dt className="text-text-muted">DEATHS</dt>
            <dd className="tabular-nums text-text">{country.deaths}</dd>
            <dt className="text-text-muted">STATUS</dt>
            <dd className="text-text">{country.status?.toUpperCase() ?? '—'}</dd>
            <dt className="text-text-muted">FIRST</dt>
            <dd className="text-text">{country.first_case_date ?? '—'}</dd>
            <dt className="text-text-muted">LATEST</dt>
            <dd className="text-text">{country.latest_case_date ?? '—'}</dd>
          </dl>
        )}
        <section>
          <SectionHeader>CASES IN {countryCode}</SectionHeader>
          {list.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">No known cases linked to this country.</p>
          ) : (
            <ul className="mt-2 flex flex-col">
              {list.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`?case=${c.case_code}`}
                    replace
                    scroll={false}
                    className="flex items-center justify-between border-b border-border-soft py-2 last:border-0 hover:bg-surface-2"
                  >
                    <span className="font-mono text-[11.5px] text-text">{caseLabel(c)}</span>
                    <CaseStatusPill status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  const headerLabel = caseCode ? `DOSSIER · ${caseCode}` : countryCode ? `COUNTRY · ${countryCode}` : 'DETAILS';

  if (!open) return null;
  return (
    <>
      <aside
        data-testid="dossier-drawer"
        className="fixed right-0 z-30 w-full max-w-[420px] overflow-y-auto border-l border-border-strong bg-surface-2"
        style={{ top: '36px', bottom: '0' }}
      >
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-bg-2 px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
            {headerLabel}
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Close drawer"
            className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:bg-surface-3 hover:text-text"
          >
            <X size={16} />
          </button>
        </div>
        {body}
      </aside>
      {showFull && selectedCase && (
        <CaseDossierModal
          case_={selectedCase}
          locations={caseLocations}
          sourceEvent={selectedSourceEvent}
          onClose={() => setShowFull(false)}
        />
      )}
    </>
  );
}
