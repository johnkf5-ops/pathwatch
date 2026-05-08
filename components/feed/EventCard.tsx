import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { Event } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { SignificanceDot } from '@/components/ui/SignificanceDot';
import { CategoryPill } from '@/components/ui/CategoryPill';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { TimeAgo } from '@/components/ui/TimeAgo';
import { SourceIcon } from '@/components/ui/SourceIcon';

export function EventCard({ event }: { event: Event }) {
  return (
    <Card className="relative p-4 transition-colors hover:bg-surface-hover focus-within:ring-2 focus-within:ring-accent">
      <div className="mb-2 flex items-center gap-3">
        <SignificanceDot level={event.significance} />
        <SourceIcon source={event.source_type} />
        <TimeAgo iso={event.occurred_at ?? event.created_at} />
      </div>
      <h3 className="text-base font-semibold leading-snug text-text">
        <Link
          href={`/event/${event.id}`}
          className="after:absolute after:inset-0 after:content-[''] focus:outline-none"
        >
          {event.title}
        </Link>
      </h3>
      <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-text-secondary">{event.summary}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <CategoryPill category={event.category} />
        {event.country_code && (
          <span className="inline-flex items-center gap-1 text-text-secondary">
            <CountryFlag code={event.country_code} />
            <span>{event.location_name ?? event.country_code}</span>
          </span>
        )}
        {event.source_url && (
          <a
            href={event.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 ml-auto inline-flex items-center gap-1 text-accent hover:underline"
          >
            Source <ExternalLink size={12} />
          </a>
        )}
      </div>
    </Card>
  );
}
