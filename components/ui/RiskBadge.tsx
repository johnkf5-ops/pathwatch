import { cn } from '@/lib/utils';
import type { RiskLevel } from '@/lib/types';

const STYLES: Record<RiskLevel, string> = {
  low: 'bg-sig-2/15 text-sig-2 border-sig-2/40',
  moderate: 'bg-sig-3/15 text-sig-3 border-sig-3/40',
  high: 'bg-sig-4/15 text-sig-4 border-sig-4/40',
  critical: 'bg-sig-5/15 text-sig-5 border-sig-5/40 shadow-[0_0_24px_-8px_#FF3B3B]',
};

export function RiskBadge({ level }: { level: RiskLevel | null }) {
  if (!level) return <span data-testid="risk-badge" className="text-text-muted">—</span>;
  return (
    <span
      data-testid="risk-badge"
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide',
        STYLES[level],
      )}
    >
      Risk: {level}
    </span>
  );
}
