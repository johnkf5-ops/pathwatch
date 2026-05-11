import type { OutbreakTimelineEntry } from '@/lib/types';
import { SectionHeader } from './SectionHeader';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10));
  if (!m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}`;
}

export function OutbreakTimeline({ entries }: { entries: OutbreakTimelineEntry[] }) {
  if (entries.length === 0) {
    return null;
  }

  const ordered = [...entries].sort((a, b) => b.day_num - a.day_num);
  const latestDay = ordered[0].day_num;

  return (
    <section className="border-b border-border px-4 py-4">
      <SectionHeader>OUTBREAK TIMELINE</SectionHeader>
      <ol className="mt-3 space-y-1.5">
        {ordered.map((row) => {
          const isLatest = row.day_num === latestDay;
          return (
            <li
              key={row.id}
              className="flex items-baseline gap-2 font-mono text-[12px] leading-snug"
            >
              <span
                className={
                  isLatest
                    ? 'text-green tabular-nums'
                    : 'text-text-muted tabular-nums'
                }
              >
                D{String(row.day_num).padStart(2, '0')}
              </span>
              <span className="text-text-muted">·</span>
              <span className="text-text-muted tabular-nums">{shortDate(row.occurred_on)}</span>
              <span className="text-text-muted">·</span>
              <span className={isLatest ? 'text-text' : 'text-text-secondary'}>{row.snippet}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
