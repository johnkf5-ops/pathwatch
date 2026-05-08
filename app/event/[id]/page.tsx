import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { EventDetail } from '@/components/event/EventDetail';
import type { Event } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function fetchEvent(id: string): Promise<Event | null> {
  noStore();
  const supabase = createServerClient();
  const { data } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
  return (data as Event | null) ?? null;
}

async function fetchRelated(event: Event): Promise<Event[]> {
  const supabase = createServerClient();
  const filters: string[] = [`category.eq.${event.category}`];
  if (event.country_code) filters.push(`country_code.eq.${event.country_code}`);
  const { data } = await supabase
    .from('events')
    .select('*')
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
  if (!event) return { title: 'Event not found — Pathwatch' };
  return {
    title: `${event.title} — Pathwatch`,
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
  return <EventDetail event={event} related={related} />;
}
