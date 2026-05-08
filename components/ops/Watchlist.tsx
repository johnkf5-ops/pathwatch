import type { Event } from '@/lib/types';
import { SectionHeader } from './SectionHeader';
import { WatchlistItem } from './WatchlistItem';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function Watchlist({ events }: { events: Event[] }) {
  const cutoff = Date.now() - ONE_DAY_MS;
  const top = events
    .filter((e) => new Date(e.occurred_at ?? e.created_at).getTime() >= cutoff)
    .sort((a, b) => {
      if (a.significance !== b.significance) return b.significance - a.significance;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, 5);

  return (
    <section className="px-4 py-4">
      <SectionHeader>WATCHLIST</SectionHeader>
      {top.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">No alerts in the last 24 hours.</p>
      ) : (
        <ul className="mt-2">
          {top.map((e) => (
            <WatchlistItem key={e.id} event={e} />
          ))}
        </ul>
      )}
    </section>
  );
}
