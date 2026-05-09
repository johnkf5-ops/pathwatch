import Link from 'next/link';
import type { Snapshot } from '@/lib/types';

const RISK_COLOR: Record<NonNullable<Snapshot['risk_level']>, string> = {
  low: 'text-green border-green',
  moderate: 'text-amber border-amber',
  high: 'text-orange border-orange',
  critical: 'text-red border-red',
};

function utcStamp() {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mn = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yy}-${mm}-${dd} ${hh}:${mn}Z`;
}

export function TopBar({ snapshot }: { snapshot: Snapshot | null }) {
  const risk = snapshot?.risk_level ?? null;
  const fatality = snapshot?.fatality_rate;
  const riskClass = risk ? RISK_COLOR[risk] : 'text-text-muted border-border';
  const riskLabel = risk
    ? `RISK ${risk.toUpperCase()}${fatality != null ? ` · ${(fatality * 100).toFixed(0)}%` : ''}`
    : 'RISK —';

  return (
    <header className="flex h-8 items-center gap-4 border-b border-border bg-bg-2 px-4 font-mono text-[10.5px] uppercase tracking-[0.14em]">
      <Link href="/" className="flex items-center gap-2">
        <span className="inline-flex h-4 w-4 items-center justify-center bg-green text-[10px] font-bold text-bg">P</span>
        <span className="font-bold tracking-[0.16em] text-text">PATHWATCH</span>
      </Link>
      <span className="hidden text-text-muted lg:inline">OPS CONSOLE</span>
      <span className="flex items-center gap-1.5 text-green">
        <span className="dot-pulse inline-block h-1.5 w-1.5 rounded-full bg-green" />
        LIVE
      </span>
      <span className="ml-auto hidden items-center gap-4 text-text-secondary lg:flex">
        <span>SCOPE GLOBAL</span>
        <span className="border-l border-border pl-4">UTC {utcStamp()}</span>
        <span className={`border-l border-border pl-4 ${riskClass.split(' ')[0]}`}>{riskLabel}</span>
      </span>
    </header>
  );
}
