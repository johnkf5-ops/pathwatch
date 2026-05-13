import type { Metadata } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { FactsClient } from '@/components/facts/FactsClient';
import { TopBar } from '@/components/ops/TopBar';
import type { Fact, Snapshot } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Hantavirus Knowledge Base — Verified Facts',
  description:
    'Source-cited facts about hantavirus, Andes virus (ANDV), and the 2026 MV Hondius outbreak. Categories: pathogen, transmission, clinical, epidemiology, history, containment.',
  alternates: { canonical: '/facts' },
};

const breadcrumbLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Hantavirus Tracker', item: 'https://hantavirustracer.com/' },
    { '@type': 'ListItem', position: 2, name: 'Knowledge Base', item: 'https://hantavirustracer.com/facts' },
  ],
};

export default async function FactsPage() {
  noStore();
  const supabase = createServerClient();
  const [factsRes, snapshotRes] = await Promise.all([
    supabase
      .from('facts')
      .select('*')
      .eq('disease', 'hantavirus')
      .order('category', { ascending: true })
      .order('confidence', { ascending: false, nullsFirst: false }),
    supabase
      .from('snapshots')
      .select('*')
      .eq('disease', 'hantavirus')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const facts = (factsRes.data as Fact[] | null) ?? [];
  const snapshot = (snapshotRes.data as Snapshot | null) ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <TopBar snapshot={snapshot} threat={null} monitoringCount={0} caseCount={0} />
      <FactsClient facts={facts} />
    </div>
  );
}
