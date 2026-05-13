import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { EventDetail } from '@/components/event/EventDetail';
import { EVENT_PUBLIC_COLUMNS } from '@/lib/types';
import type { Event } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function fetchEvent(id: string): Promise<Event | null> {
  noStore();
  const supabase = createServerClient();
  const { data } = await supabase.from('events').select(EVENT_PUBLIC_COLUMNS).eq('id', id).maybeSingle();
  return (data as Event | null) ?? null;
}

async function fetchRelated(event: Event): Promise<Event[]> {
  const supabase = createServerClient();
  const filters: string[] = [`category.eq.${event.category}`];
  if (event.country_code) filters.push(`country_code.eq.${event.country_code}`);
  const { data } = await supabase
    .from('events')
    .select(EVENT_PUBLIC_COLUMNS)
    .or(filters.join(','))
    .neq('id', event.id)
    .is('duplicate_of', null)
    .eq('disease', event.disease)
    .order('created_at', { ascending: false })
    .limit(5);
  return (data as Event[] | null) ?? [];
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const event = await fetchEvent(params.id);
  if (!event) return { title: 'Event not found — Hantavirus Tracker' };
  return {
    title: `${event.title} — Hantavirus Tracker`,
    description: event.summary,
    openGraph: {
      title: event.title,
      description: event.summary,
      type: 'article',
    },
  };
}

export default async function EventPage({ params }: { params: { id: string } }) {
  const event = await fetchEvent(params.id);
  if (!event) notFound();
  const related = await fetchRelated(event);

  const eventDate = event.occurred_at ?? event.created_at;
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: event.title,
      description: event.summary ?? undefined,
      datePublished: eventDate,
      dateModified: event.created_at,
      author: event.source_author
        ? { '@type': 'Person', name: event.source_author }
        : { '@type': 'Organization', name: event.source_type ?? 'Hantavirus Tracker' },
      publisher: { '@type': 'Organization', name: 'Hantavirus Tracker' },
      mainEntityOfPage: `https://hantavirustracer.com/event/${event.id}`,
      isAccessibleForFree: true,
      ...(event.source_url ? { sameAs: event.source_url } : {}),
      ...(event.country_code
        ? {
            contentLocation: {
              '@type': 'Place',
              address: { '@type': 'PostalAddress', addressCountry: event.country_code },
            },
          }
        : {}),
      keywords: (event.tags ?? []).filter((t) => !t.startsWith('clarifies:')).join(', '),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Hantavirus Tracker', item: 'https://hantavirustracer.com/' },
        { '@type': 'ListItem', position: 2, name: 'Events', item: 'https://hantavirustracer.com/' },
        {
          '@type': 'ListItem',
          position: 3,
          name: event.title,
          item: `https://hantavirustracer.com/event/${event.id}`,
        },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EventDetail event={event} related={related} />
    </>
  );
}
