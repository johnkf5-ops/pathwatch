'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Case, CaseLocation, CountryStat } from '@/lib/types';
import { MapPanel } from '@/components/map/MapPanel';

const KEY = 'pathwatch:mobile-map-open';

interface Props {
  countries: CountryStat[];
  cases: Case[];
  caseLocations: CaseLocation[];
  selectedCaseId: string | null;
  caseCount: number;
  contactCount: number;
}

export function MapWithToggle({ countries, cases, caseLocations, selectedCaseId, caseCount, contactCount }: Props) {
  const [open, setOpen] = useState<boolean>(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY);
    if (stored === 'closed') setOpen(false);
    setHydrated(true);
  }, []);

  function toggle() {
    setOpen((v) => {
      const next = !v;
      try { window.localStorage.setItem(KEY, next ? 'open' : 'closed'); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <section className="border-b border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border-soft px-4 py-2">
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-green hover:text-text"
          aria-expanded={open}
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {open ? 'Hide Map' : 'Show Map'}
        </button>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
          {caseCount} CASES · {contactCount} CONTACTS · {countries.length} COUNTRIES
        </span>
      </div>
      {hydrated && open && (
        <div className="relative h-[55vh]">
          <MapPanel
            countries={countries}
            cases={cases}
            caseLocations={caseLocations}
            selectedCaseId={selectedCaseId}
          />
        </div>
      )}
    </section>
  );
}
