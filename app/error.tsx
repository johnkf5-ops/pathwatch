'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-[760px] px-6 py-12 text-center">
      <h1 className="mb-2 text-2xl font-semibold text-text">Something went wrong</h1>
      <p className="mb-6 text-sm text-text-secondary">{error.message || 'Unable to load dashboard.'}</p>
      <button
        onClick={() => reset()}
        className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-surface-hover"
      >
        Try again
      </button>
    </main>
  );
}
