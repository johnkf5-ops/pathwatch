import { createServerClient } from '@/lib/supabase-server';
import { parseFilters } from '@/lib/filters';
import { DashboardClient } from './DashboardClient';
import type { Event, Snapshot, CountryStat } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Home({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseFilters(searchParams);
  const supabase = createServerClient();

  let eventsQuery = supabase
    .from('events')
    .select('*')
    .eq('disease', 'hantavirus')
    .is('duplicate_of', null);
  if (filters.significance) eventsQuery = eventsQuery.gte('significance', filters.significance);
  if (filters.source) eventsQuery = eventsQuery.eq('source_type', filters.source);
  if (filters.category) eventsQuery = eventsQuery.eq('category', filters.category);
  eventsQuery = eventsQuery.order('created_at', { ascending: false }).range(0, filters.limit - 1);

  const [snapshotRes, eventsRes, countriesRes] = await Promise.all([
    supabase
      .from('snapshots')
      .select('*')
      .eq('disease', 'hantavirus')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    eventsQuery,
    supabase.from('country_stats').select('*').eq('disease', 'hantavirus'),
  ]);

  return (
    <DashboardClient
      initialSnapshot={(snapshotRes.data as Snapshot | null) ?? null}
      initialEvents={(eventsRes.data as Event[] | null) ?? []}
      initialCountries={(countriesRes.data as CountryStat[] | null) ?? []}
      initialFilters={filters}
    />
  );
}
