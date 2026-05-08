'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Event } from '@/lib/types';
import { EVENT_TABS, type EventTabId } from '@/lib/event-tabs';

export function EventTabBar({ events, active }: { events: Event[]; active: EventTabId }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setTab(id: EventTabId) {
    const u = new URLSearchParams(searchParams.toString());
    if (id === 'all') u.delete('tab');
    else u.set('tab', id);
    const qs = u.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em]">
      {EVENT_TABS.map((t) => {
        const count = t.id === 'all' ? events.length : events.filter(t.predicate).length;
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={isActive}
            className={`flex items-center gap-1.5 border px-2 py-1 ${
              isActive
                ? 'border-green text-text bg-surface-2'
                : 'border-border text-text-muted hover:text-text'
            }`}
          >
            <span>{t.label}</span>
            <span className={`text-[9px] ${isActive ? 'text-text-secondary' : 'text-text-faint'}`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
