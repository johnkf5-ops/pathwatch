import { unstable_noStore as noStore } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { DashboardClient } from './DashboardClient';
import type {
  Event, Snapshot, CountryStat, Case, CaseLocation, ThreatAssessment, Fact,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Home() {
  noStore();
  const supabase = createServerClient();

  const [
    snapshotRes,
    snapshotHistoryRes,
    eventsRes,
    countriesRes,
    casesRes,
    locationsRes,
    threatRes,
    factsRes,
  ] = await Promise.all([
    supabase
      .from('snapshots')
      .select('*')
      .eq('disease', 'hantavirus')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('snapshots')
      .select('*')
      .eq('disease', 'hantavirus')
      .order('created_at', { ascending: true })
      .limit(30),
    supabase
      .from('events')
      .select('*')
      .eq('disease', 'hantavirus')
      .is('duplicate_of', null)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('country_stats').select('*').eq('disease', 'hantavirus'),
    supabase.from('cases').select('*').eq('disease', 'hantavirus'),
    supabase.from('case_locations').select('*'),
    supabase
      .from('threat_assessments')
      .select('*')
      .eq('disease', 'hantavirus')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('facts')
      .select('*')
      .eq('disease', 'hantavirus')
      .neq('verification_status', 'retracted')
      .order('confidence', { ascending: false }),
  ]);

  return (
    <DashboardClient
      initialSnapshot={(snapshotRes.data as Snapshot | null) ?? null}
      initialSnapshotHistory={(snapshotHistoryRes.data as Snapshot[] | null) ?? []}
      initialEvents={(eventsRes.data as Event[] | null) ?? []}
      initialCountries={(countriesRes.data as CountryStat[] | null) ?? []}
      initialCases={(casesRes.data as Case[] | null) ?? []}
      initialCaseLocations={(locationsRes.data as CaseLocation[] | null) ?? []}
      initialThreat={(threatRes.data as ThreatAssessment | null) ?? null}
      initialFacts={(factsRes.data as Fact[] | null) ?? []}
    />
  );
}
