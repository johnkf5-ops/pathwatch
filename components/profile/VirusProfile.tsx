'use client';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Fact, FactCategory } from '@/lib/types';

// ─── tile slots ───────────────────────────────────────────────────────────────

interface SlotDef {
  tag: string;
  label: string;
  /** Returns the short value text for the tile. */
  value: (f: Fact) => string;
  /** Optional plain-English explanation of the value. Only present where jargon needs decoding. */
  descriptor?: (f: Fact) => string | null;
}

/** Strip leading-prefix words that duplicate the tile label, drop parentheticals. */
function tidyTitle(t: string, dropPrefixes: string[] = []): string {
  let s = t.trim();
  for (const p of dropPrefixes) {
    const re = new RegExp(`^${p}[:\\s-]+`, 'i');
    s = s.replace(re, '');
  }
  // Strip parenthetical clarifications: "Andes orthohantavirus (ANDV)" -> "Andes orthohantavirus"
  s = s.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  // Cut at sentence boundary only — keep comma'd lists intact.
  s = s.split(/[.;]/, 1)[0].trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function extractRange(t: string, suffix = ''): string | null {
  const m = t.match(/(\d+)\s*[-–]\s*(\d+)/);
  return m ? `${m[1]}–${m[2]}${suffix}` : null;
}

const SLOTS: SlotDef[] = [
  {
    tag: 'key:strain',
    label: 'Virus',
    value: (f) => tidyTitle(f.title, ['strain', 'causative agent identified as']),
  },
  {
    tag: 'key:family',
    label: 'Virus family',
    value: (f) => tidyTitle(f.title, ['family']),
  },
  {
    tag: 'key:reservoir',
    label: 'Carried by',
    value: (f) => tidyTitle(f.title, ['ANDV reservoir host is the', 'reservoir host', 'reservoir host:', 'carried by']),
  },
  {
    tag: 'key:transmission',
    label: 'How it spreads',
    value: (f) => tidyTitle(f.title, ['person-to-person ANDV requires', 'spreads only through', 'transmission:']),
  },
  {
    tag: 'key:cfr',
    label: 'Fatality rate',
    value: (f) => extractRange(f.title, '%') ?? extractRange(f.content, '%') ?? '—',
  },
  {
    tag: 'key:r0',
    label: 'Reproduction number',
    value: (f) => {
      const m = f.title.match(/R0?\s*(?:below|<|less than)\s*([\d.]+)/i)
            ?? f.content.match(/R0?\s*(?:below|<|less than)\s*([\d.]+)/i);
      if (m) return `< ${m[1]}`;
      const n = (f.title + ' ' + f.content).match(/(?:R0|R₀)\s*[~≈=]?\s*([\d.]+)/i);
      return n ? n[1] : '—';
    },
    descriptor: (f) => {
      if (/(below|<|less than)\s*1/i.test(f.title + ' ' + f.content)) {
        return 'Each case infects fewer than one other person; outbreaks fade on their own.';
      }
      return null;
    },
  },
  {
    tag: 'key:incubation',
    label: 'Incubation period',
    value: (f) => extractRange(f.title, ' days') ?? extractRange(f.content, ' days') ?? '—',
    descriptor: (f) => {
      const m = f.title.match(/(\d+)\s*[-–]\s*(\d+)/) ?? f.content.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (m && Number(m[2]) >= 30) return 'Symptoms can appear weeks after exposure.';
      return null;
    },
  },
  {
    tag: 'key:symptoms',
    label: 'Symptoms',
    value: (f) => tidyTitle(f.title, ['symptoms:', 'symptoms']),
    descriptor: () => 'First flu-like (fever, muscle pain), then rapid lung failure.',
  },
  {
    tag: 'key:past_outbreaks',
    label: 'Past outbreaks',
    value: (f) => {
      const years = (f.title + ' ' + f.content).match(/\b(19|20)\d{2}\b/g);
      if (years) return [...new Set(years)].slice(0, 4).join(' · ');
      return tidyTitle(f.title, ['past ANDV outbreaks:', 'past outbreaks:']);
    },
    descriptor: () => 'All previous ANDV outbreaks have burned out on their own.',
  },
  {
    tag: 'key:treatment',
    label: 'Treatment',
    value: (f) => tidyTitle(f.title, ['no specific antiviral; care is supportive including', 'no cure exists.']),
  },
  {
    tag: 'key:vaccine',
    label: 'Vaccine',
    value: (f) => tidyTitle(f.title, ['no licensed hantavirus vaccine;', 'no vaccine exists.']),
    descriptor: (f) => /no\s+(licensed|vaccine\s+exists)/i.test(f.title) ? 'No licensed vaccine; candidates years away.' : null,
  },
  {
    tag: 'key:first_identified',
    label: 'First identified',
    value: (f) => {
      const m = f.title.match(/(\d{4})/);
      const year = m ? m[1] : '';
      const place = (f.content.match(/in\s+([A-Z][a-zA-ZÀ-ſ\s]+(?:,\s*[A-Z][a-zA-ZÀ-ſ\s]+)?)/) ?? [])[1];
      return [year, place?.split(/\.|;/)[0]?.trim()].filter(Boolean).join(' · ') || tidyTitle(f.title);
    },
  },
];

// ─── full categorised list (expanded view) ────────────────────────────────────

const CATEGORY_ORDER: FactCategory[] = [
  'pathogen', 'transmission', 'clinical', 'epidemiology',
  'containment', 'history', 'outbreak_timeline', 'policy',
];
const CATEGORY_LABEL: Record<FactCategory, string> = {
  pathogen: 'Pathogen',
  transmission: 'Transmission',
  clinical: 'Clinical',
  epidemiology: 'Epidemiology',
  containment: 'Containment',
  history: 'History',
  outbreak_timeline: 'Outbreak timeline',
  policy: 'Policy',
};

// ─── component ────────────────────────────────────────────────────────────────

function findKeyFact(facts: Fact[], tag: string): Fact | undefined {
  return facts.find((f) => f.tags?.includes(tag));
}

export function VirusProfile({ facts }: { facts: Fact[] }) {
  const [open, setOpen] = useState(false);

  const tiles = useMemo(
    () => SLOTS.map((s) => {
      const f = findKeyFact(facts, s.tag);
      return {
        ...s,
        fact: f,
        value: f ? s.value(f) : '—',
        descriptor: f ? s.descriptor?.(f) ?? null : null,
      };
    }),
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
      {/* Title row */}
      <header className="flex items-center justify-between px-4 pb-3 pt-4">
        <h2 className="font-mono text-[14px] font-semibold tracking-[0.02em] text-text">Virus Profile</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted hover:text-text"
        >
          {open ? 'Collapse' : 'Expand'}
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </header>

      {/* Tile grid */}
      <dl className="grid grid-cols-1 gap-px border-t border-border-soft bg-border-soft sm:grid-cols-2 md:grid-cols-3">
        {tiles.map((s) => (
          <div key={s.tag} className="bg-bg px-4 py-3 min-w-0">
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
              {s.label}
            </dt>
            <dd className="mt-1 font-mono text-[14px] leading-snug text-text">{s.value}</dd>
            {s.descriptor && (
              <p className="mt-1.5 text-[12px] leading-relaxed text-text-secondary">{s.descriptor}</p>
            )}
          </div>
        ))}
      </dl>

      {/* Expanded full list */}
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
