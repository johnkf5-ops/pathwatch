import Link from 'next/link';

export const metadata = { title: 'About — Pathwatch' };

export default function About() {
  return (
    <main className="mx-auto max-w-[760px] px-6 py-10 text-text-secondary">
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
      <Link href="/" className="mt-8 inline-block text-accent hover:underline">
        ← Back to dashboard
      </Link>
    </main>
  );
}
