'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { Radio } from 'lucide-react';
import type { NewsLogEntry } from '@/lib/types';

const BREAKING_WINDOW_MS = 10 * 60 * 1000;

function isFresh(iso: string | null, now: number): boolean {
  if (!iso) return false;
  return now - new Date(iso).getTime() <= BREAKING_WINDOW_MS;
}

function ago(iso: string | null): string {
  if (!iso) return '';
  try {
    return formatDistanceToNowStrict(parseISO(iso)).toUpperCase();
  } catch {
    return '';
  }
}

interface ItemCardProps {
  item: NewsLogEntry;
  breaking: boolean;
}

function ItemCard({ item, breaking }: ItemCardProps) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-full shrink-0 items-center gap-2 border-r border-border px-3 font-mono text-[11px] uppercase tracking-[0.1em] text-text-secondary transition-colors hover:bg-surface-2 hover:text-text focus:outline-none focus:ring-1 focus:ring-green"
      title={item.title}
    >
      {breaking && (
        <span className="flex items-center gap-1 border border-red bg-red/10 px-1.5 py-0.5 text-[10px] font-semibold text-red">
          <Radio size={10} /> BREAKING
        </span>
      )}
      <span className="text-text-muted">{item.source_domain.toUpperCase()}</span>
      <span className="text-text-faint">·</span>
      <span className="text-text-muted">{ago(item.published_at)} AGO</span>
      <span className="text-text-faint">·</span>
      <span className="line-clamp-1 normal-case tracking-normal text-text">{item.title}</span>
    </a>
  );
}

// Anchor the scroll position to wall-clock time so every client sees the
// same frame of the loop and refreshes pick up mid-stream instead of
// restarting from 0. SCROLL_LOOP_S must match the animation duration in
// app/globals.css (`.news-screener-track { animation: scroll-news <N>s ... }`).
const SCROLL_LOOP_S = 60;

export function NewsScreener({ items }: { items: NewsLogEntry[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // animationDelay is undefined on first render (SSR + hydration), then set
  // in useEffect once we're client-side. Tiny one-frame settle, no hydration
  // mismatch. The negative delay tells CSS to start the loop at the wall-clock
  // offset, syncing every viewer.
  const [animationDelay, setAnimationDelay] = useState<string | undefined>(undefined);
  useEffect(() => {
    setAnimationDelay(`-${(Date.now() / 1000) % SCROLL_LOOP_S}s`);
  }, []);

  const ordered = useMemo(() => {
    return [...items]
      .filter((it) => it.published_at != null)
      .sort((a, b) => {
        const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
        const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 60);
  }, [items]);

  if (ordered.length === 0) {
    return (
      <div
        data-testid="news-screener"
        className="flex h-9 items-center border-b border-border bg-bg-2 px-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-muted"
      >
        AWAITING FIRST CREDIBLE-SOURCE HEADLINE…
      </div>
    );
  }

  return (
    <div
      data-testid="news-screener"
      className="relative flex h-9 items-stretch overflow-hidden border-b border-border bg-bg-2"
    >
      <span
        className="relative z-10 flex shrink-0 items-center gap-1.5 border-r border-border bg-bg px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted"
        aria-hidden
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan" />
        NEWS WIRE
      </span>
      <div
        className="news-screener-track relative z-0 flex min-w-0 flex-1 items-stretch whitespace-nowrap"
        style={animationDelay ? { animationDelay } : undefined}
      >
        {ordered.map((item) => (
          <ItemCard
            key={`a-${item.id}`}
            item={item}
            breaking={isFresh(item.published_at, now)}
          />
        ))}
        {ordered.map((item) => (
          <ItemCard
            key={`b-${item.id}`}
            item={item}
            breaking={isFresh(item.published_at, now)}
          />
        ))}
      </div>
    </div>
  );
}
