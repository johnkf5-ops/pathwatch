import type { CaseStatus } from '@/lib/types';
import { STATUS_LABEL } from '@/lib/case-helpers';

const PILL: Record<CaseStatus, string> = {
  monitoring: 'border-cyan text-cyan',
  suspected: 'border-text-secondary text-text-secondary',
  confirmed: 'border-amber text-amber',
  critical: 'border-orange text-orange',
  deceased: 'border-red text-red',
  recovered: 'border-green text-green',
};

export function CaseStatusPill({ status }: { status: CaseStatus }) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] ${PILL[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
