'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { Case, CaseLocation, Event } from '@/lib/types';
import { CaseDossier } from './CaseDossier';

interface Props {
  case_: Case;
  locations: CaseLocation[];
  sourceEvent: Event | null;
  onClose: () => void;
}

export function CaseDossierModal({ case_, locations, sourceEvent, onClose }: Props) {
  // Close on Escape; lock body scroll while modal is open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="grid w-full max-w-[760px] grid-rows-[auto_minmax(0,1fr)] rounded border border-border-strong bg-bg shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-bg-2 px-4 py-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
            FULL DOSSIER · {case_.case_code}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:bg-surface-3 hover:text-text"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto">
          <CaseDossier case_={case_} locations={locations} sourceEvent={sourceEvent} />
        </div>
      </div>
    </div>
  );
}
