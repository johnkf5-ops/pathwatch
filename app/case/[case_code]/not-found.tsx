import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-[760px] px-6 py-16 text-center">
      <h1 className="mb-2 font-mono text-2xl font-bold uppercase tracking-[0.05em] text-text">CASE NOT FOUND</h1>
      <p className="mb-6 text-sm text-text-secondary">
        That case code doesn&apos;t correspond to any record.
      </p>
      <Link href="/" className="font-mono text-xs uppercase tracking-[0.1em] text-accent hover:underline">
        ← BACK TO DASHBOARD
      </Link>
    </main>
  );
}
