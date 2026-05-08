'use client';
import { cn } from '@/lib/utils';

export interface Tab {
  id: string;
  label: string;
  count?: number;
}

export function TabStrip({
  tabs,
  active,
  onChange,
}: {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" className="flex border-b border-border bg-bg-2 font-mono text-[10.5px] uppercase tracking-[0.1em]">
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 transition-colors',
              isActive
                ? 'border-b-2 border-green bg-surface text-text'
                : 'text-text-muted hover:text-text',
            )}
          >
            <span>{t.label}</span>
            {t.count != null && (
              <span className="rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] text-text-secondary">
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
