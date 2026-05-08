import { cn } from '@/lib/utils';
import type { Significance } from '@/lib/types';

const COLOR: Record<Significance, string> = {
  1: 'bg-sig-1',
  2: 'bg-sig-2',
  3: 'bg-sig-3',
  4: 'bg-sig-4',
  5: 'bg-sig-5',
};

const LABEL: Record<Significance, string> = {
  1: 'Routine',
  2: 'Low',
  3: 'Notable',
  4: 'High',
  5: 'Critical',
};

export function SignificanceDot({ level, className }: { level: Significance; className?: string }) {
  return (
    <span
      aria-label={`Significance: ${LABEL[level]}`}
      title={LABEL[level]}
      className={cn('inline-block h-2.5 w-2.5 rounded-full', COLOR[level], className)}
    />
  );
}
