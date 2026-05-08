import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: string;
  testId?: string;
  hint?: string;
  className?: string;
}

export function StatCard({ label, value, testId, hint, className }: StatCardProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-surface p-4', className)}>
      <div className="text-xs uppercase tracking-wide text-text-muted">{label}</div>
      <div data-testid={testId} className="font-mono text-3xl font-bold tabular-nums text-text">
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-text-secondary">{hint}</div>}
    </div>
  );
}
