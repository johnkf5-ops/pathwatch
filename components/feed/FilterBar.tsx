'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Significance, SourceType, Category } from '@/lib/types';

const SIG_OPTIONS: { value: Significance; label: string }[] = [
  { value: 5, label: 'CRITICAL' },
  { value: 4, label: 'HIGH+' },
  { value: 3, label: 'NOTABLE+' },
];

const SOURCE_OPTIONS: SourceType[] = [
  'who', 'cdc', 'ecdc', 'africa_cdc', 'google_news', 'reddit', 'x', 'bluesky', 'wikipedia',
];

const CATEGORY_OPTIONS: Category[] = [
  'case_report', 'policy', 'research', 'travel_advisory', 'containment', 'death', 'mutation', 'speculation',
];

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sig = searchParams.get('sig');
  const source = searchParams.get('source');
  const category = searchParams.get('category');

  function setParam(key: string, value: string | null) {
    const u = new URLSearchParams(searchParams.toString());
    if (value == null || value === '') u.delete(key);
    else u.set(key, value);
    const qs = u.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em]">
      <span className="text-text-muted">SIG</span>
      <button
        onClick={() => setParam('sig', null)}
        className={`border px-2 py-0.5 ${
          !sig ? 'border-green text-text' : 'border-border text-text-muted hover:text-text'
        }`}
      >
        ALL
      </button>
      {SIG_OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => setParam('sig', String(o.value))}
          className={`border px-2 py-0.5 ${
            sig === String(o.value) ? 'border-green text-text' : 'border-border text-text-muted hover:text-text'
          }`}
        >
          {o.label}
        </button>
      ))}

      <span className="ml-2 text-text-muted">SOURCE</span>
      <select
        value={source ?? ''}
        onChange={(e) => setParam('source', e.target.value || null)}
        className="border border-border bg-surface px-2 py-0.5 text-text"
      >
        <option value="">ANY</option>
        {SOURCE_OPTIONS.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <span className="ml-2 text-text-muted">CATEGORY</span>
      <select
        value={category ?? ''}
        onChange={(e) => setParam('category', e.target.value || null)}
        className="border border-border bg-surface px-2 py-0.5 text-text"
      >
        <option value="">ANY</option>
        {CATEGORY_OPTIONS.map((c) => (
          <option key={c} value={c}>{c.replace('_', ' ')}</option>
        ))}
      </select>
    </div>
  );
}
