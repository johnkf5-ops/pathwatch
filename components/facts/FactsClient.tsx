'use client';
import { useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Fact, FactCategory, VerificationStatus } from '@/lib/types';
import { FactCard } from './FactCard';

const CATEGORIES: FactCategory[] = [
  'pathogen', 'transmission', 'clinical', 'epidemiology',
  'containment', 'history', 'outbreak_timeline', 'policy',
];

const STATUSES: VerificationStatus[] = ['confirmed', 'corroborated', 'unverified', 'disputed'];

export function FactsClient({ facts }: { facts: Fact[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const category = searchParams.get('category') as FactCategory | null;
  const verification = searchParams.get('verification') as VerificationStatus | null;
  const q = searchParams.get('q') ?? '';

  function setParam(key: string, value: string | null) {
    const u = new URLSearchParams(searchParams.toString());
    if (value == null || value === '') u.delete(key);
    else u.set(key, value);
    const qs = u.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return facts
      .filter((f) => {
        if (category && f.category !== category) return false;
        if (verification && f.verification_status !== verification) return false;
        if (f.verification_status === 'retracted' && verification !== 'retracted') return false;
        if (ql && !`${f.title} ${f.content}`.toLowerCase().includes(ql)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        const ac = a.confidence ?? -1;
        const bc = b.confidence ?? -1;
        return bc - ac;
      });
  }, [facts, category, verification, q]);

  return (
    <main className="mx-auto flex max-w-[960px] flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="font-mono text-[26px] font-bold leading-tight tracking-[-0.01em] text-text">
          KNOWLEDGE BASE
        </h1>
        <p className="mt-1 max-w-[60ch] text-[13px] leading-[1.5] text-text-secondary">
          Verified facts about the outbreak. Each entry has a confidence score and source attribution.
          Pipeline writes corroborate or supersede entries as new intel comes in.
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-2 border-y border-border py-3 font-mono text-[10.5px] uppercase tracking-[0.1em]">
        <span className="text-text-muted">CATEGORY</span>
        <button
          onClick={() => setParam('category', null)}
          className={`border px-2 py-1 ${
            !category ? 'border-green text-text' : 'border-border text-text-muted hover:text-text'
          }`}
        >
          ALL
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setParam('category', c)}
            className={`border px-2 py-1 ${
              category === c ? 'border-green text-text' : 'border-border text-text-muted hover:text-text'
            }`}
          >
            {c.replace('_', ' ')}
          </button>
        ))}

        <span className="ml-4 text-text-muted">STATUS</span>
        <select
          value={verification ?? ''}
          onChange={(e) => setParam('verification', e.target.value || null)}
          className="border border-border bg-surface px-2 py-1 text-text"
        >
          <option value="">ANY</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="retracted">retracted</option>
        </select>

        <input
          type="search"
          placeholder="search…"
          value={q}
          onChange={(e) => setParam('q', e.target.value || null)}
          className="ml-auto w-48 border border-border bg-surface px-2 py-1 text-text placeholder:text-text-muted"
        />
      </section>

      {filtered.length === 0 ? (
        <p className="border border-dashed border-border p-6 text-center text-sm text-text-muted">
          No facts match these filters.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((f) => (
            <FactCard key={f.id} fact={f} />
          ))}
        </div>
      )}
    </main>
  );
}
