'use client';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Fact, FactCategory } from '@/lib/types';

// ─── slot definitions ─────────────────────────────────────────────────────────

interface SlotDef {
  tag: string;
  label: string;
  /** Returns the short value to render in the tile (e.g. "< 1", "9–40d"). */
  value: (f: Fact) => string;
  /** Optional contextual descriptor under the value (e.g. "Cannot sustain spread"). */
  descriptor?: (f: Fact) => string | null;
}

// Squeeze a long fact title into a short tile-friendly value.
function shortenTitle(t: string): string {
  // strip leading "ANDV ", "Causative agent identified as ", "No specific antiviral; care is "
  let s = t.replace(/^(ANDV\s+)/i, '');
  s = s.replace(/^Causative agent identified as\s+/i, '');
  s = s.replace(/^No specific antiviral;\s+care is supportive including\s+/i, '');
  s = s.replace(/^No licensed hantavirus vaccine;\s*/i, '');
  s = s.replace(/^Person-to-person ANDV requires\s+/i, '');
  s = s.replace(/^reservoir host is the\s+/i, '');
  // Drop parenthetical Latin / clarifications
  s = s.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  // Cut at first comma/semicolon — keep the head clause
  s = s.split(/[,;]/, 1)[0].trim();
  // Capitalise first char
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function extractRange(t: string, suffix = ''): string | null {
  const m = t.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!m) return null;
  return `${m[1]}–${m[2]}${suffix}`;
}

const HERO: SlotDef = {
  tag: 'key:cfr',
  label: 'Case fatality rate',
  value: (f) => extractRange(f.title, '%') ?? extractRange(f.content, '%') ?? '—',
};

const STATS: SlotDef[] = [
  {
    tag: 'key:r0',
    label: 'R₀',
    value: (f) => {
      const m = f.title.match(/R0?\s*(?:below|<|less than)\s*([\d.]+)/i)
            ?? f.content.match(/R0?\s*(?:below|<|less than)\s*([\d.]+)/i);
      if (m) return `< ${m[1]}`;
      const n = (f.title + ' ' + f.content).match(/[\b\s](?:R0|R₀)\s*[~≈=]?\s*([\d.]+)/i);
      return n ? n[1] : '—';
    },
    descriptor: (f) => {
      const v = (f.title + ' ' + f.content).match(/(?:below|<|less than)\s*1/i);
      return v ? 'Cannot sustain spread' : null;
    },
  },
  {
    tag: 'key:incubation',
    label: 'Incubation',
    value: (f) => extractRange(f.title, 'd') ?? extractRange(f.content, 'd') ?? '—',
    descriptor: (f) => {
      const m = f.title.match(/(\d+)\s*[-–]\s*(\d+)/) ?? f.content.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (m && Number(m[2]) >= 30) return 'Long tail';
      return null;
    },
  },
  { tag: 'key:reservoir',    label: 'Reservoir',       value: (f) => shortenTitle(f.title) },
  { tag: 'key:strain',       label: 'Strain',          value: (f) => shortenTitle(f.title) },
  { tag: 'key:transmission', label: 'Transmission',    value: (f) => shortenTitle(f.title) },
  { tag: 'key:family',       label: 'Family',          value: (f) => shortenTitle(f.title) },
  { tag: 'key:treatment',    label: 'Treatment',       value: (f) => shortenTitle(f.title) },
  { tag: 'key:vaccine',      label: 'Vaccine',         value: (f) => shortenTitle(f.title) },
  { tag: 'key:first_identified', label: 'First identified', value: (f) => {
      const m = f.title.match(/(\d{4})/);
      const year = m ? m[1] : '';
      const place = (f.content.match(/in\s+([A-Z][a-zA-ZÀ-ſ\s]+(?:,\s*[A-Z][a-zA-ZÀ-ſ\s]+)?)/) ?? [])[1];
      return [year, place?.split(/\.|;/)[0]?.trim()].filter(Boolean).join(' · ') || shortenTitle(f.title);
    },
  },
];

// ─── CFR severity scale (LOW / MOD / HIGH / SEVERE) ───────────────────────────

type CfrZone = 'LOW' | 'MOD' | 'HIGH' | 'SEVERE';
const CFR_ZONES: { id: CfrZone; max: number; cls: string }[] = [
  { id: 'LOW',    max: 5,    cls: 'bg-green' },
  { id: 'MOD',    max: 15,   cls: 'bg-amber' },
  { id: 'HIGH',   max: 30,   cls: 'bg-orange' },
  { id: 'SEVERE', max: 100,  cls: 'bg-red' },
];

function cfrZone(value: string): CfrZone | null {
  // value formats: "30–50%", "35–40%", "30%", etc. Use the upper bound.
  const m = value.match(/(\d+)(?:[-–](\d+))?/);
  if (!m) return null;
  const upper = Number(m[2] ?? m[1]);
  for (const z of CFR_ZONES) if (upper <= z.max) return z.id;
  return 'SEVERE';
}

// ─── full categorised list (expanded view) ────────────────────────────────────

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

// ─── component ────────────────────────────────────────────────────────────────

function findKeyFact(facts: Fact[], tag: string): Fact | undefined {
  return facts.find((f) => f.tags?.includes(tag));
}

export function VirusProfile({ facts }: { facts: Fact[] }) {
  const [open, setOpen] = useState(false);

  const heroFact = useMemo(() => findKeyFact(facts, HERO.tag), [facts]);
  const heroValue = heroFact ? HERO.value(heroFact) : '—';
  const zone = heroFact ? cfrZone(heroValue) : null;

  const slots = useMemo(
    () => STATS.map((s) => {
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

  const shown = (heroFact ? 1 : 0) + slots.filter((s) => s.fact).length;
  const strainFact = useMemo(() => findKeyFact(facts, 'key:strain'), [facts]);
  const strainName = strainFact ? shortenTitle(strainFact.title).toUpperCase() : '';
  const lastUpdate = useMemo(() => {
    const ts = facts
      .map((f) => f.last_verified_at ?? f.updated_at)
      .filter((t): t is string => !!t)
      .sort()
      .pop();
    return ts ? format(parseISO(ts), 'HH:mm:ss') + ' UTC' : '';
  }, [facts]);

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
      {/* Top metadata strip */}
      <div className="border-b border-border-soft bg-bg-2 px-4 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">
        <span className="text-text-secondary">HANTAVIRUS</span>
        {strainName && <> · <span>{strainName}</span></>}
        {lastUpdate && <> · LAST UPDATE <span suppressHydrationWarning>{lastUpdate}</span></>}
        {' '}· {facts.length} FACTS INDEXED
      </div>

      {/* Title row */}
      <header className="flex items-center justify-between px-4 pb-3 pt-3">
        <h2 className="font-mono text-[14px] font-semibold tracking-[0.02em] text-text">Virus Profile</h2>
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
          <span>
            <span className="text-text">{shown}</span> shown · <span className="text-text">{facts.length}</span> total
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 hover:text-text"
          >
            {open ? 'Collapse' : 'Expand'}
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </header>

      {/* Hero CFR */}
      <div className="border-t border-border-soft px-4 py-4">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">{HERO.label}</span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-mono text-[42px] font-bold leading-none tracking-[-0.02em] text-text">
            {heroValue.replace('%', '')}
          </span>
          <span className="font-mono text-[18px] text-text-secondary">%</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1">
          {CFR_ZONES.map((z) => {
            const active = z.id === zone;
            return (
              <div key={z.id} className="flex flex-col items-stretch gap-1">
                <div className={`h-1.5 ${active ? z.cls : 'bg-border'}`} />
                <span
                  className={`font-mono text-[9.5px] uppercase tracking-[0.14em] ${
                    active ? 'text-text' : 'text-text-faint'
                  }`}
                >
                  {z.id}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stat grid */}
      <dl className="grid grid-cols-1 gap-px border-t border-border-soft bg-border-soft sm:grid-cols-2 md:grid-cols-3">
        {slots.map((s) => (
          <div key={s.tag} className="bg-bg px-3 py-3 min-w-0">
            <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">{s.label}</dt>
            <dd className="mt-0.5 line-clamp-2 font-mono text-[13px] leading-snug text-text">{s.value}</dd>
            {s.descriptor && (
              <div className="mt-0.5 font-mono text-[10px] tracking-[0.06em] text-text-secondary">
                {s.descriptor}
              </div>
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
