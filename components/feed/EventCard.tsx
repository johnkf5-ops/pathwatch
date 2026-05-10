import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import type { Event } from '@/lib/types';
import { SignificanceDot } from '@/components/ui/SignificanceDot';
import { CategoryPill } from '@/components/ui/CategoryPill';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { SourceIcon } from '@/components/ui/SourceIcon';

export function EventCard({ event }: { event: Event }) {
  const age = formatDistanceToNowStrict(parseISO(event.occurred_at ?? event.created_at)).toUpperCase();

  return (
    <article className="relative border border-border bg-surface p-3 transition-colors hover:bg-surface-2 focus-within:ring-2 focus-within:ring-green">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
        <SignificanceDot level={event.significance} />
        <SourceIcon source={event.source_type} label={event.source_author} />
        <span suppressHydrationWarning>{age} AGO</span>
      </div>

      <h3 className="mt-1.5 font-mono text-[13px] font-semibold leading-snug text-text">
        <Link
          href={`/event/${event.id}`}
          className="after:absolute after:inset-0 after:content-[''] focus:outline-none"
        >
          {event.title}
        </Link>
      </h3>

      <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-text-secondary">
        {event.summary}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
        <CategoryPill category={event.category} />
        {event.country_code && (
          <span className="inline-flex items-center gap-1 font-mono uppercase tracking-[0.1em] text-text-muted">
            <CountryFlag code={event.country_code} />
            <span>{event.country_code}</span>
          </span>
        )}
        {event.source_url && (
          <a
            href={event.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 ml-auto inline-flex items-center gap-1 font-mono uppercase tracking-[0.1em] text-text-muted hover:text-text"
          >
            SOURCE <ExternalLink size={10} />
          </a>
        )}
      </div>
    </article>
  );
}
