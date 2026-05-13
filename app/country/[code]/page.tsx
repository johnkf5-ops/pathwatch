import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { TopBar } from '@/components/ops/TopBar';
import { caseLabel } from '@/lib/case-helpers';
import type { Case, CountryStat, Snapshot, ThreatAssessment } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function fetchCountry(code: string): Promise<{
  country: CountryStat | null;
  cases: Case[];
  snapshot: Snapshot | null;
  threat: ThreatAssessment | null;
}> {
  noStore();
  const supabase = createServerClient();
  const upper = code.toUpperCase();

  const [countryRes, casesRes, snapshotRes, threatRes] = await Promise.all([
    supabase
      .from('country_stats')
      .select('*')
      .eq('disease', 'hantavirus')
      .eq('country_code', upper)
      .maybeSingle(),
    supabase
      .from('cases')
      .select('*')
      .eq('disease', 'hantavirus')
      .or(`current_country.eq.${upper},exposure_country.eq.${upper}`),
    supabase
      .from('snapshots')
      .select('*')
      .eq('disease', 'hantavirus')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('threat_assessments')
      .select('*')
      .eq('disease', 'hantavirus')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    country: (countryRes.data as CountryStat | null) ?? null,
    cases: (casesRes.data as Case[] | null) ?? [],
    snapshot: (snapshotRes.data as Snapshot | null) ?? null,
    threat: (threatRes.data as ThreatAssessment | null) ?? null,
  };
}

export async function generateMetadata({
  params,
}: {
  params: { code: string };
}): Promise<Metadata> {
  const { country } = await fetchCountry(params.code);
  if (!country) return { title: 'Country not found' };
  const code = params.code.toUpperCase();
  const title = `Hantavirus in ${country.country_name} — MV Hondius Outbreak Cases & Status`;
  const description = `Hantavirus cases, deaths, and outbreak response in ${country.country_name} (${country.cases} case${country.cases === 1 ? '' : 's'}, ${country.deaths} death${country.deaths === 1 ? '' : 's'}). Live tracking of MV Hondius-related cases, contacts, and country status.`;
  return {
    title,
    description,
    alternates: { canonical: `/country/${code}` },
    openGraph: { title, description, type: 'article' },
  };
}

const STATUS_COPY: Record<string, string> = {
  active: 'Active monitoring — confirmed or suspected cases under investigation.',
  monitoring: 'Country has identified contacts under surveillance but no confirmed cases.',
  recovered: 'Country status: previously affected, no current active cases.',
  cleared: 'Country status: cleared; no further surveillance required.',
};

export default async function CountryPage({ params }: { params: { code: string } }) {
  const { country, cases, snapshot, threat } = await fetchCountry(params.code);
  if (!country) notFound();
  const code = params.code.toUpperCase();
  const currentCases = cases.filter((c) => c.current_country === code);
  const exposureCases = cases.filter(
    (c) => c.exposure_country === code && c.current_country !== code,
  );
  const statusCopy = country.status ? STATUS_COPY[country.status] ?? '' : '';

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: `Hantavirus in ${country.country_name}`,
      description: `Outbreak data for ${country.country_name}: ${country.cases} cases, ${country.deaths} deaths, status ${country.status ?? 'unknown'}.`,
      author: { '@type': 'Organization', name: 'Hantavirus Tracker' },
      publisher: { '@type': 'Organization', name: 'Hantavirus Tracker' },
      datePublished: country.first_case_date ?? '2026-05-01',
      dateModified: country.updated_at,
      mainEntityOfPage: `https://hantavirustracer.com/country/${code}`,
      about: {
        '@type': 'Place',
        name: country.country_name,
        address: { '@type': 'PostalAddress', addressCountry: code },
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Hantavirus Tracker', item: 'https://hantavirustracer.com/' },
        { '@type': 'ListItem', position: 2, name: 'Countries', item: 'https://hantavirustracer.com/' },
        {
          '@type': 'ListItem',
          position: 3,
          name: country.country_name,
          item: `https://hantavirustracer.com/country/${code}`,
        },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar snapshot={snapshot} threat={threat} monitoringCount={0} caseCount={0} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto w-full max-w-[840px] px-6 py-10 text-text-secondary">
        <nav className="mb-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
          <Link href="/" className="hover:text-text">Hantavirus Tracker</Link>
          <span className="mx-2">›</span>
          <Link href={`/?country=${code}`} className="hover:text-text" scroll={false}>
            Countries
          </Link>
          <span className="mx-2">›</span>
          <span>{country.country_name}</span>
        </nav>

        <h1 className="mb-2 text-3xl font-bold text-text">
          Hantavirus in {country.country_name}
        </h1>
        <p className="mb-6 text-sm text-text-muted">
          Outbreak status and case-level data for the MV Hondius hantavirus cluster.
        </p>

        <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Cases" value={country.cases} />
          <Stat label="Deaths" value={country.deaths} />
          <Stat
            label="Latest case"
            value={country.latest_case_date?.slice(0, 10) ?? '—'}
            small
          />
          <Stat label="Status" value={(country.status ?? '—').toUpperCase()} small />
        </section>

        {statusCopy && (
          <section className="mb-8 rounded border border-border p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-text-muted">
              Current status
            </h2>
            <p className="leading-relaxed">{statusCopy}</p>
            {country.travel_advisory && (
              <p className="mt-2 leading-relaxed">
                <strong>Travel advisory:</strong> {country.travel_advisory}
              </p>
            )}
            {country.notes && <p className="mt-2 leading-relaxed">{country.notes}</p>}
          </section>
        )}

        {currentCases.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold text-text">
              Cases currently in {country.country_name}
            </h2>
            <ul className="space-y-2">
              {currentCases.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/case/${encodeURIComponent(c.case_code)}`}
                    className="block rounded border border-border p-3 hover:border-accent hover:text-text"
                  >
                    <div className="font-mono text-xs uppercase tracking-wider text-text-muted">
                      {c.case_code}
                    </div>
                    <div className="text-text">{caseLabel(c)}</div>
                    {c.status && (
                      <div className="mt-1 text-xs text-text-muted">
                        Status: {c.status} · Class: {c.case_class ?? '—'}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {exposureCases.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold text-text">
              Cases linked to exposure in {country.country_name}
            </h2>
            <p className="mb-3 text-sm text-text-muted">
              Patients exposed in {country.country_name} but currently elsewhere.
            </p>
            <ul className="space-y-2">
              {exposureCases.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/case/${encodeURIComponent(c.case_code)}`}
                    className="block rounded border border-border p-3 hover:border-accent hover:text-text"
                  >
                    <div className="font-mono text-xs uppercase tracking-wider text-text-muted">
                      {c.case_code} · now in {c.current_country ?? '—'}
                    </div>
                    <div className="text-text">{caseLabel(c)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-12 border-t border-border pt-6 text-sm">
          <p className="mb-2 text-text-muted">
            <Link href={`/?country=${code}`} className="text-accent hover:underline" scroll={false}>
              View {country.country_name} on the live dashboard →
            </Link>
          </p>
          <p className="text-text-muted">
            For the broader outbreak see the{' '}
            <Link href="/" className="text-accent hover:underline">main tracker</Link>.
            For disease background see{' '}
            <Link href="/hantavirus" className="text-accent hover:underline">/hantavirus</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  small = false,
}: {
  label: string;
  value: number | string;
  small?: boolean;
}) {
  return (
    <div className="rounded border border-border p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
        {label}
      </div>
      <div
        className={`mt-1 font-semibold tabular-nums text-text ${small ? 'text-base' : 'text-2xl'}`}
      >
        {value}
      </div>
    </div>
  );
}
