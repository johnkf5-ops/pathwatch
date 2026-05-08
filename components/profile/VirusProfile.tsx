'use client';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Fact, FactCategory } from '@/lib/types';
import { SectionHeader } from '@/components/ops/SectionHeader';

const KEY_STATS: { tag: string; label: string }[] = [
  { tag: 'key:transmission_mode', label: 'TRANSMISSION' },
  { tag: 'key:cfr',                label: 'CASE FATALITY' },
  { tag: 'key:incubation',         label: 'INCUBATION' },
  { tag: 'key:r0',                 label: 'R0' },
  { tag: 'key:treatment',          label: 'TREATMENT' },
  { tag: 'key:vaccine_status',     label: 'VACCINE' },
  { tag: 'key:reservoir_host',     label: 'RESERVOIR' },
];

const CATEGORY_ORDER: FactCategory[] = [
  'pathogen', 'transmission', 'clinical', 'epidemiology',
  'containment', 'history', 'outbreak_timeline', 'policy',
];

const CATEGORY_LABEL: Record<FactCategory, string> = {
  pathogen: 'PATHOGEN',
  transmission: 'TRANSMISSION',
  clinical: 'CLINICAL',
  epidemiology: 'EPIDEMIOLOGY',
  containment: 'CONTAINMENT',
  history: 'HISTORY',
  outbreak_timeline: 'OUTBREAK TIMELINE',
  policy: 'POLICY',
};

function findKeyFact(facts: Fact[], tag: string): Fact | undefined {
  return facts.find((f) => f.tags?.includes(tag));
}

export function VirusProfile({ facts }: { facts: Fact[] }) {
  const [open, setOpen] = useState(false);

  const keyStats = useMemo(
    () => KEY_STATS.map((k) => ({ ...k, fact: findKeyFact(facts, k.tag) })),
    [facts],
  );

  const grouped = useMemo(() => {
    const m = new Map<FactCategory, Fact[]>();
    for (const f of facts) {
      const list = m.get(f.category) ?? [];
      list.push(f);
      m.set(f.category, list);
    }
    return m;
  }, [facts]);

  return (
    <section className="border-t border-border bg-bg">
      <header className="flex items-center justify-between px-4 py-3">
        <SectionHeader>
          VIRUS PROFILE
          <span className="ml-2 font-mono text-[10px] tracking-[0.1em] text-text-muted">
            {facts.length} FACTS
          </span>
        </SectionHeader>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted hover:text-text"
        >
          {open ? 'COLLAPSE' : 'EXPAND'}
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border px-4 py-3 lg:grid-cols-3 xl:grid-cols-4">
        {keyStats.map(({ tag, label, fact }) => (
          <div key={tag} className="min-w-0">
            <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">
              {label}
            </dt>
            <dd className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-text">
              {fact?.title ?? '—'}
            </dd>
          </div>
        ))}
      </dl>

      {open && (
        <div className="border-t border-border px-4 py-4">
          {CATEGORY_ORDER.map((cat) => {
            const list = grouped.get(cat);
            if (!list || list.length === 0) return null;
            return (
              <section key={cat} className="mb-4 last:mb-0">
                <h3 className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-secondary">
                  {CATEGORY_LABEL[cat]} <span className="text-text-faint">{list.length}</span>
                </h3>
                <ul className="space-y-2">
                  {list.map((f) => (
                    <li key={f.id} className="border-l-2 border-border-soft pl-3">
                      <div className="font-mono text-[12px] font-semibold text-text">{f.title}</div>
                      <p className="mt-0.5 text-[12px] leading-snug text-text-secondary">{f.content}</p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
