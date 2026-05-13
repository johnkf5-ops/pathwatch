import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { CaseDossier } from '@/components/case/CaseDossier';
import { EVENT_PUBLIC_COLUMNS } from '@/lib/types';
import type { Case, CaseLocation, Event } from '@/lib/types';
import { caseLabel } from '@/lib/case-helpers';

export const dynamic = 'force-dynamic';

async function fetchCase(case_code: string): Promise<{
  case_: Case | null;
  locations: CaseLocation[];
  sourceEvent: Event | null;
}> {
  noStore();
  const supabase = createServerClient();
  const { data: case_ } = await supabase
    .from('cases')
    .select('*')
    .eq('case_code', case_code)
    .maybeSingle();
  if (!case_) return { case_: null, locations: [], sourceEvent: null };

  const [locRes, eventRes] = await Promise.all([
    supabase.from('case_locations').select('*').eq('case_id', case_.id),
    case_.source_event_id
      ? supabase.from('events').select(EVENT_PUBLIC_COLUMNS).eq('id', case_.source_event_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    case_: case_ as Case,
    locations: (locRes.data as CaseLocation[] | null) ?? [],
    sourceEvent: (eventRes.data as Event | null) ?? null,
  };
}

export async function generateMetadata({
  params,
}: {
  params: { case_code: string };
}): Promise<Metadata> {
  const { case_ } = await fetchCase(params.case_code);
  if (!case_) return { title: 'Case not found — Hantavirus Tracker' };
  const label = caseLabel(case_);
  return {
    title: `${label} — Hantavirus Tracker`,
    description: case_.dossier?.slice(0, 200) ?? `Case dossier for ${label}`,
  };
}

export default async function CasePage({ params }: { params: { case_code: string } }) {
  const { case_, locations, sourceEvent } = await fetchCase(params.case_code);
  if (!case_) notFound();
  const label = caseLabel(case_);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: `${label} — Hantavirus Case Dossier`,
      description: case_.dossier?.slice(0, 240) ?? `Case dossier for ${label}`,
      author: { '@type': 'Organization', name: 'Hantavirus Tracker' },
      publisher: { '@type': 'Organization', name: 'Hantavirus Tracker' },
      datePublished: case_.created_at,
      dateModified: case_.updated_at ?? case_.created_at,
      mainEntityOfPage: `https://hantavirustracer.com/case/${encodeURIComponent(case_.case_code)}`,
      ...(case_.current_country
        ? {
            contentLocation: {
              '@type': 'Place',
              address: { '@type': 'PostalAddress', addressCountry: case_.current_country },
            },
          }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Hantavirus Tracker', item: 'https://hantavirustracer.com/' },
        { '@type': 'ListItem', position: 2, name: 'Cases', item: 'https://hantavirustracer.com/' },
        {
          '@type': 'ListItem',
          position: 3,
          name: label,
          item: `https://hantavirustracer.com/case/${encodeURIComponent(case_.case_code)}`,
        },
      ],
    },
  ];

  return (
    <main className="mx-auto max-w-[840px] px-6 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link
        href="/"
        className="mb-6 inline-block font-mono text-xs uppercase tracking-[0.1em] text-accent hover:underline"
      >
        ← BACK TO DASHBOARD
      </Link>
      <CaseDossier case_={case_} locations={locations} sourceEvent={sourceEvent} />
    </main>
  );
}
