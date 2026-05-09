import Link from 'next/link';
import { Monitor } from 'lucide-react';
import type { Snapshot, ThreatAssessment } from '@/lib/types';
import { THREAT_LEVEL_TOKEN } from '@/lib/threat-triggers';
import { LiveVisitorCount } from './LiveVisitorCount';

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

export function TopBar({
  snapshot,
  threat,
}: {
  snapshot: Snapshot | null;
  threat: ThreatAssessment | null;
}) {
  const risk = snapshot?.risk_level ?? null;
  const fatality = snapshot?.fatality_rate;
  const riskClass = risk ? RISK_COLOR[risk] : 'text-text-muted border-border';
  const riskLabel = risk
    ? `RISK ${risk.toUpperCase()}${fatality != null ? ` · ${(fatality * 100).toFixed(0)}%` : ''}`
    : 'RISK —';
  const t = threat ? THREAT_LEVEL_TOKEN[threat.threat_level] : null;
  const pct = threat ? (threat.pandemic_probability * 100).toFixed(1) : null;

  return (
    <header className="flex h-9 items-center gap-3 border-b border-border bg-bg-2 px-3 font-mono text-[10.5px] uppercase tracking-[0.14em] lg:gap-4 lg:px-4">
      <Link href="/" className="flex items-center gap-2">
        <span className="inline-flex h-4 w-4 items-center justify-center bg-green text-[10px] font-bold text-bg">P</span>
        <span className="font-bold tracking-[0.16em] text-text">PATHWATCH</span>
      </Link>
      <span className="hidden text-text-muted lg:inline">OPS CONSOLE</span>
      <span className="flex items-center gap-1.5 text-green">
        <span className="dot-pulse inline-block h-1.5 w-1.5 rounded-full bg-green" />
        LIVE
      </span>
      {threat && t && (
        <span className="flex items-center gap-2 border-l border-border pl-3 lg:pl-4">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${t.dotCls}`} />
          <span className={`border px-1.5 py-0.5 ${t.borderCls} ${t.textCls}`}>{t.label}</span>
          <span className="text-[13px] font-semibold leading-none text-text lg:text-[15px]">{pct}%</span>
          <span className="hidden text-text-muted lg:inline">PANDEMIC PROBABILITY</span>
        </span>
      )}
      {/* Mobile-only note nudging users toward the desktop layout */}
      <span
        className="ml-auto flex items-center gap-1.5 text-amber/80 lg:hidden"
        title="This intelligence console is optimized for desktop. Some panels are condensed on mobile."
      >
        <Monitor size={11} />
        <span>DESKTOP RECOMMENDED</span>
      </span>
      <span className="hidden items-center gap-4 text-text-secondary lg:ml-auto lg:flex">
        <span>SCOPE GLOBAL</span>
        <span className="border-l border-border pl-4">
          <LiveVisitorCount />
        </span>
        <span className="border-l border-border pl-4">UTC {utcStamp()}</span>
        <span className={`border-l border-border pl-4 ${riskClass.split(' ')[0]}`}>{riskLabel}</span>
      </span>
    </header>
  );
}
