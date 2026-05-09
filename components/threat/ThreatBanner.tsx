'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ThreatAssessment } from '@/lib/types';
import { ProbabilityMeter } from './ProbabilityMeter';
import { PolymarketComparison } from './PolymarketComparison';
import { ThreatPanelExpanded } from './ThreatPanelExpanded';

export function ThreatBanner({ assessment }: { assessment: ThreatAssessment }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2 lg:gap-6 lg:px-4"
        aria-expanded={open}
      >
        <ProbabilityMeter assessment={assessment} />
        <PolymarketComparison assessment={assessment} />
        <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
          {open ? 'COLLAPSE' : 'EXPAND'}
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>
      {open && <ThreatPanelExpanded assessment={assessment} />}
    </div>
  );
}
