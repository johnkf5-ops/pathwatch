import type { VerificationStatus } from '@/lib/types';

const STYLES: Record<VerificationStatus, string> = {
  confirmed: 'border-green text-green',
  corroborated: 'border-cyan text-cyan',
  unverified: 'border-border-strong text-text-muted',
  disputed: 'border-orange text-orange',
  retracted: 'border-red text-red line-through',
};

const LABELS: Record<VerificationStatus, string> = {
  confirmed: 'CONFIRMED',
  corroborated: 'CORROBORATED',
  unverified: 'UNVERIFIED',
  disputed: 'DISPUTED',
  retracted: 'RETRACTED',
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
