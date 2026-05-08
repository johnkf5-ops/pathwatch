import type { Metadata } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';
import { FactsClient } from '@/components/facts/FactsClient';
import { TopBar } from '@/components/ops/TopBar';
import type { Fact, Snapshot } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Knowledge Base — Pathwatch',
  description: 'Verified facts about the 2026 MV Hondius hantavirus outbreak.',
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
      <TopBar snapshot={snapshot} />
      <FactsClient facts={facts} />
    </div>
  );
}
