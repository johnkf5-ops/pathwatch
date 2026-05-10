import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Pathwatch — Real-Time Hantavirus Outbreak Tracker',
  description:
    'About Pathwatch: how the 2026 MV Hondius hantavirus tracker works, data sources (WHO, CDC, ECDC), and pipeline architecture.',
  alternates: { canonical: '/about' },
};

const breadcrumbLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Pathwatch', item: 'https://hantavirustracer.com/' },
    { '@type': 'ListItem', position: 2, name: 'About', item: 'https://hantavirustracer.com/about' },
  ],
};

export default function About() {
  return (
    <main className="mx-auto max-w-[760px] px-6 py-10 text-text-secondary">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <nav className="mb-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
        <Link href="/" className="hover:text-text">Pathwatch</Link>
        <span className="mx-2">›</span>
        <span>About</span>
      </nav>
      <h1 className="mb-4 text-3xl font-bold text-text">About Pathwatch</h1>
      <p className="mb-3 leading-relaxed">
        Pathwatch is a real-time disease outbreak tracker. V1 covers the 2026 MV Hondius hantavirus
        cluster (Andes orthohantavirus, the only hantavirus with documented human-to-human transmission).
      </p>
      <h2 className="mb-2 mt-6 text-xl font-semibold text-text">How the data works</h2>
      <p className="mb-3 leading-relaxed">
        A backend pipeline (separate process) scrapes WHO Disease Outbreak News, CDC, ECDC, Africa CDC,
        Google News, Reddit, X, BlueSky, and Wikipedia. An LLM dedupes, classifies, scores significance,
        and tags geography. Structured rows land in Supabase. This dashboard reads them via the anon key
        and subscribes to live updates.
      </p>
      <h2 className="mb-2 mt-6 text-xl font-semibold text-text">Disclaimer</h2>
      <p className="mb-3 leading-relaxed">
        This dashboard aggregates publicly available information for situational awareness. It is not
        medical advice and should not be used as a basis for clinical or travel decisions. For
        authoritative guidance, consult{' '}
        <a className="text-accent hover:underline" href="https://www.who.int">WHO</a>, your country&apos;s
        public health authority, or a qualified healthcare provider.
      </p>
      <div className="mt-8 flex flex-wrap gap-4 text-sm">
        <Link href="/" className="text-accent hover:underline">← Back to dashboard</Link>
        <Link href="/hantavirus" className="text-accent hover:underline">Disease overview</Link>
        <Link href="/hantavirus#faq" className="text-accent hover:underline">FAQ</Link>
        <Link href="/facts" className="text-accent hover:underline">Knowledge base</Link>
      </div>
    </main>
  );
}
