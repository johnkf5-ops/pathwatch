import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { Event } from '@/lib/types';
import { SignificanceDot } from '@/components/ui/SignificanceDot';
import { SourceIcon } from '@/components/ui/SourceIcon';
import { TimeAgo } from '@/components/ui/TimeAgo';
import { CategoryPill } from '@/components/ui/CategoryPill';
import { CountryFlag } from '@/components/ui/CountryFlag';
import { Badge } from '@/components/ui/Badge';
import { formatNumber } from '@/lib/format';
import { RelatedEvents } from './RelatedEvents';

export function EventDetail({ event, related }: { event: Event; related: Event[] }) {
  return (
    <main className="mx-auto max-w-[1100px] px-6 py-8">
      <Link href="/" className="mb-6 inline-block text-sm text-accent hover:underline">
        ← Back to dashboard
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <article>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <SignificanceDot level={event.significance} />
            <SourceIcon source={event.source_type} label={event.source_author} />
            <TimeAgo iso={event.occurred_at ?? event.created_at} />
            {event.is_verified && <Badge variant="outline">Verified</Badge>}
          </div>

          <h1 className="mb-4 text-3xl font-bold leading-tight text-text">{event.title}</h1>

          <p className="mb-6 text-base leading-relaxed text-text-secondary">{event.summary}</p>

          <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
            <CategoryPill category={event.category} />
            {event.country_code && (
              <span className="inline-flex items-center gap-1.5 text-text-secondary">
                <CountryFlag code={event.country_code} />
                <span>{event.location_name ?? event.country_code}</span>
              </span>
            )}
            {event.source_url && (
              <a
                href={event.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-accent hover:underline"
              >
                Source <ExternalLink size={14} />
              </a>
            )}
          </div>

          <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-border bg-surface p-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Cases</dt>
              <dd className="font-mono tabular-nums">{formatNumber(event.case_count)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Deaths</dt>
              <dd className="font-mono tabular-nums">{formatNumber(event.death_count)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Author</dt>
              <dd>{event.source_author ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-text-muted">Disease</dt>
              <dd className="capitalize">{event.disease}</dd>
            </div>
          </dl>

          {event.tags && event.tags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {event.tags.map((t) => (
                <Badge key={t} variant="outline">
                  #{t}
                </Badge>
              ))}
            </div>
          )}

          {event.raw_content && (
            <details className="rounded-xl border border-border bg-surface p-4">
              <summary className="cursor-pointer text-sm font-medium text-text">Raw source content</summary>
              <pre className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">
                {event.raw_content}
              </pre>
            </details>
          )}
        </article>

        <aside>
          <RelatedEvents events={related} />
        </aside>
      </div>
    </main>
  );
}
