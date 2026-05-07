'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { FilterState, Significance, SourceType, Category } from '@/lib/types';

const SIG_OPTIONS: { value: Significance; label: string }[] = [
  { value: 5, label: 'Critical only' },
  { value: 4, label: 'High+' },
  { value: 3, label: 'Notable+' },
];

const SOURCE_OPTIONS: SourceType[] = [
  'who', 'cdc', 'ecdc', 'africa_cdc', 'google_news', 'reddit', 'x', 'bluesky', 'wikipedia',
];

const CATEGORY_OPTIONS: Category[] = [
  'case_report', 'policy', 'research', 'travel_advisory', 'containment', 'death', 'mutation', 'speculation',
];

export function FilterBar({ filters }: { filters: FilterState }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const u = new URLSearchParams(searchParams.toString());
    if (value == null || value === '') u.delete(key);
    else u.set(key, value);
    const qs = u.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-text-muted">Filter:</span>

      <button
        onClick={() => setParam('sig', null)}
        className={`rounded-md px-2 py-1 ${
          !filters.significance ? 'bg-surface-hover text-text' : 'text-text-secondary hover:text-text'
        }`}
      >
        All
      </button>
      {SIG_OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => setParam('sig', String(o.value))}
          className={`rounded-md px-2 py-1 ${
            filters.significance === o.value ? 'bg-surface-hover text-text' : 'text-text-secondary hover:text-text'
          }`}
        >
          {o.label}
        </button>
      ))}

      <span className="mx-1 h-4 w-px bg-border" />

      <select
        value={filters.source ?? ''}
        onChange={(e) => setParam('source', e.target.value || null)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-text"
      >
        <option value="">Any source</option>
        {SOURCE_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        value={filters.category ?? ''}
        onChange={(e) => setParam('category', e.target.value || null)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-text"
      >
        <option value="">Any category</option>
        {CATEGORY_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {c.replace('_', ' ')}
          </option>
        ))}
      </select>
    </div>
  );
}
