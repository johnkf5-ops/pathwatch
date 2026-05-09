import type { ThreatAssessment } from '@/lib/types';
import { ProbabilityMeter } from './ProbabilityMeter';
import { PolymarketComparison } from './PolymarketComparison';
import { ThreatPanelExpanded } from './ThreatPanelExpanded';

export function ThreatBanner({ assessment }: { assessment: ThreatAssessment }) {
  return (
    <div className="border-b border-border bg-surface">
      <div className="flex w-full items-center gap-3 px-3 py-2 lg:gap-6 lg:px-4">
        <ProbabilityMeter assessment={assessment} />
        <PolymarketComparison assessment={assessment} />
      </div>
      <ThreatPanelExpanded assessment={assessment} />
    </div>
  );
}
