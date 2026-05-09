import { cn } from '@/lib/utils';

type Tone = 'good' | 'bad' | 'neutral';

const DELTA_COLOR: Record<Tone, string> = {
  good: 'text-green',
  bad: 'text-red',
  neutral: 'text-text-muted',
};

export interface KpiTileProps {
  label: string;
  value: string;
  subtitle?: string;
  delta?: string;
  deltaTone?: Tone;
  testId?: string;
}

export function KpiTile({ label, value, subtitle, delta, deltaTone = 'neutral', testId }: KpiTileProps) {
  return (
    <div className="flex flex-col gap-1 border border-border bg-surface p-3" data-testid={testId}>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-muted">{label}</div>
      <div className="font-mono text-[22px] font-bold leading-none tabular-nums text-text">{value}</div>
      {subtitle && (
        <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-faint">{subtitle}</div>
      )}
      {delta && (
        <div className={cn('font-mono text-[10.5px] tabular-nums', DELTA_COLOR[deltaTone])}>{delta}</div>
      )}
    </div>
  );
}
