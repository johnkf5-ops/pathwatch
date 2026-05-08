import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-[760px] px-6 py-16 text-center">
      <h1 className="mb-2 text-2xl font-semibold text-text">Event not found</h1>
      <p className="mb-6 text-sm text-text-secondary">
        That intelligence event doesn&apos;t exist, or it has been merged into another event as a duplicate.
      </p>
      <Link href="/" className="text-accent hover:underline">
        ← Back to dashboard
      </Link>
    </main>
  );
}
