import type { MetadataRoute } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import { createServerClient } from '@/lib/supabase-server';

const SITE = 'https://hantavirustracer.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  noStore();
  const supabase = createServerClient();

  const [casesRes, eventsRes, countriesRes] = await Promise.all([
    supabase
      .from('cases')
      .select('case_code, updated_at, created_at')
      .eq('disease', 'hantavirus'),
    supabase
      .from('events')
      .select('id, created_at')
      .eq('disease', 'hantavirus')
      .is('duplicate_of', null)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('country_stats')
      .select('country_code, updated_at')
      .eq('disease', 'hantavirus'),
  ]);

  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'hourly', priority: 1.0 },
    { url: `${SITE}/hantavirus`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE}/faq`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE}/facts`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const countryRoutes: MetadataRoute.Sitemap = (countriesRes.data ?? []).map((c) => ({
    url: `${SITE}/country/${c.country_code}`,
    lastModified: c.updated_at ? new Date(c.updated_at) : now,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  const caseRoutes: MetadataRoute.Sitemap = (casesRes.data ?? []).map((c) => ({
    url: `${SITE}/case/${encodeURIComponent(c.case_code)}`,
    lastModified: c.updated_at ? new Date(c.updated_at) : new Date(c.created_at),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  const eventRoutes: MetadataRoute.Sitemap = (eventsRes.data ?? []).map((e) => ({
    url: `${SITE}/event/${e.id}`,
    lastModified: new Date(e.created_at),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...countryRoutes, ...caseRoutes, ...eventRoutes];
}
