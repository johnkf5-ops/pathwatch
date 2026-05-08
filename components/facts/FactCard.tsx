import { format, parseISO } from 'date-fns';
import type { Fact } from '@/lib/types';
import { VerificationBadge } from './VerificationBadge';
import { ConfidenceBar } from './ConfidenceBar';

const CATEGORY_LABEL: Record<Fact['category'], string> = {
  pathogen: 'PATHOGEN',
  transmission: 'TRANSMISSION',
  clinical: 'CLINICAL',
  epidemiology: 'EPIDEMIOLOGY',
  containment: 'CONTAINMENT',
  history: 'HISTORY',
  outbreak_timeline: 'OUTBREAK TIMELINE',
  policy: 'POLICY',
};

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function FactCard({ fact }: { fact: Fact }) {
  return (
    <article className="border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
          {CATEGORY_LABEL[fact.category]}
        </span>
        <VerificationBadge status={fact.verification_status} />
      </div>

      <h3 className="mt-2 font-mono text-[16px] font-bold leading-snug tracking-[-0.01em] text-text">
        {fact.title}
      </h3>

      <p className="mt-2 text-[13px] leading-[1.55] text-text-secondary">{fact.content}</p>

      <div className="mt-3">
        <ConfidenceBar confidence={fact.confidence} />
      </div>

      {fact.sources.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="font-mono uppercase tracking-[0.1em] text-text-muted">SOURCES</span>
          {fact.sources.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-border bg-bg-2 px-1.5 py-0.5 font-mono text-text-secondary hover:border-border-strong hover:text-text"
            >
              {hostnameOf(url)}
            </a>
          ))}
        </div>
      )}

      {fact.last_verified_at && (
        <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
          LAST VERIFIED · {format(parseISO(fact.last_verified_at), 'yyyy-MM-dd')}
        </div>
      )}
    </article>
  );
}
