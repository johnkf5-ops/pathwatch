import { unstable_noStore as noStore } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { DashboardClient } from './DashboardClient';
import { EVENT_PUBLIC_COLUMNS } from '@/lib/types';
import type {
  Event, Snapshot, CountryStat, Case, CaseLocation, ThreatAssessment, Fact,
  OutbreakTimelineEntry,
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
    timelineRes,
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
    supabase
      .from('outbreak_timeline')
      .select('*')
      .eq('disease', 'hantavirus')
      .order('day_num', { ascending: false }),
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
    {
      '@context': 'https://schema.org',
      '@type': 'SpecialAnnouncement',
      name: '2026 MV Hondius Hantavirus Outbreak — Public Health Update',
      text:
        snapshot?.ai_analysis ??
        'A multi-country cluster of Andes hantavirus (ANDV) infections traced to the cruise ship MV Hondius is under active surveillance. WHO currently assesses global risk as low. Person-to-person transmission of ANDV requires close, prolonged contact; casual or brief contact is insufficient.',
      datePosted: snapshot?.created_at ?? new Date().toISOString(),
      expires: snapshot?.created_at
        ? new Date(new Date(snapshot.created_at).getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()
        : undefined,
      category: 'https://www.wikidata.org/wiki/Q166231',
      url: 'https://hantavirustracer.com',
      audience: { '@type': 'Audience', audienceType: 'General Public' },
      publisher: {
        '@type': 'Organization',
        name: 'Pathwatch',
        url: 'https://hantavirustracer.com',
      },
      about: {
        '@type': 'MedicalCondition',
        name: 'Hantavirus Pulmonary Syndrome (Andes virus)',
        code: { '@type': 'MedicalCode', code: 'B33.4', codingSystem: 'ICD-10' },
      },
      announcementLocation: snapshot?.countries_list?.length
        ? snapshot.countries_list.map((code) => ({
            '@type': 'AdministrativeArea',
            name: code,
            address: { '@type': 'PostalAddress', addressCountry: code },
          }))
        : undefined,
      diseasePreventionInfo: 'https://hantavirustracer.com/hantavirus#how-it-spreads',
      diseaseSpreadStatistics: 'https://hantavirustracer.com/',
      quarantineGuidelines: 'https://www.cdc.gov/han/php/notices/han00528.html',
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
        initialTimeline={(timelineRes.data as OutbreakTimelineEntry[] | null) ?? []}
      />
    </>
  );
}
