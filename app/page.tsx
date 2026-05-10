import { unstable_noStore as noStore } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { DashboardClient } from './DashboardClient';
import { EVENT_PUBLIC_COLUMNS } from '@/lib/types';
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
      .select(EVENT_PUBLIC_COLUMNS)
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

  const snapshot = (snapshotRes.data as Snapshot | null) ?? null;
  const threat = (threatRes.data as ThreatAssessment | null) ?? null;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Pathwatch',
      alternateName: 'Hantavirus Tracker',
      url: 'https://hantavirustracer.com',
      description:
        'Live tracking of the 2026 MV Hondius hantavirus outbreak (Andes virus, ANDV).',
      publisher: { '@type': 'Organization', name: 'Pathwatch' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: '2026 MV Hondius Hantavirus Outbreak',
      alternateName: 'MV Hondius ANDV cluster',
      description:
        'Real-time dataset of confirmed and suspected cases, deaths, contacts, country-level statistics, travel timelines, and threat assessments for the 2026 hantavirus (Andes virus) outbreak linked to the MV Hondius cruise ship.',
      url: 'https://hantavirustracer.com',
      keywords: [
        'hantavirus',
        'Andes virus',
        'ANDV',
        'MV Hondius',
        'outbreak',
        'epidemiology',
        '2026',
      ],
      isAccessibleForFree: true,
      license: 'https://creativecommons.org/licenses/by/4.0/',
      creator: { '@type': 'Organization', name: 'Pathwatch' },
      temporalCoverage: '2026-04/..',
      spatialCoverage: snapshot?.countries_list?.length
        ? { '@type': 'Place', name: snapshot.countries_list.join(', ') }
        : undefined,
      variableMeasured: [
        { '@type': 'PropertyValue', name: 'Total cases', value: snapshot?.total_cases ?? null },
        { '@type': 'PropertyValue', name: 'Total deaths', value: snapshot?.total_deaths ?? null },
        {
          '@type': 'PropertyValue',
          name: 'Countries affected',
          value: snapshot?.countries_affected ?? null,
        },
        {
          '@type': 'PropertyValue',
          name: 'Pandemic probability',
          value: threat?.pandemic_probability ?? null,
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'MedicalCondition',
      name: 'Hantavirus Pulmonary Syndrome (Andes virus)',
      alternateName: ['HPS', 'ANDV infection', 'Andes orthohantavirus disease'],
      code: { '@type': 'MedicalCode', code: 'B33.4', codingSystem: 'ICD-10' },
      cause: { '@type': 'MedicalCause', name: 'Andes orthohantavirus (ANDV)' },
      epidemiology:
        'The Andes virus is the only hantavirus with documented person-to-person transmission, primarily through close or prolonged contact. Reservoir host is the long-tailed pygmy rice rat (Oligoryzomys longicaudatus). Case fatality rate is reported up to 50% in severe cases.',
      signOrSymptom: [
        { '@type': 'MedicalSignOrSymptom', name: 'Fever' },
        { '@type': 'MedicalSignOrSymptom', name: 'Pulmonary edema' },
        { '@type': 'MedicalSignOrSymptom', name: 'Acute respiratory distress syndrome' },
        { '@type': 'MedicalSignOrSymptom', name: 'Gastrointestinal symptoms' },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DashboardClient
        initialSnapshot={snapshot}
        initialSnapshotHistory={(snapshotHistoryRes.data as Snapshot[] | null) ?? []}
        initialEvents={(eventsRes.data as Event[] | null) ?? []}
        initialCountries={(countriesRes.data as CountryStat[] | null) ?? []}
        initialCases={(casesRes.data as Case[] | null) ?? []}
        initialCaseLocations={(locationsRes.data as CaseLocation[] | null) ?? []}
        initialThreat={threat}
        initialFacts={(factsRes.data as Fact[] | null) ?? []}
      />
    </>
  );
}
