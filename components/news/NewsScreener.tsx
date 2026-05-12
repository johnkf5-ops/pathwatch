'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { Radio } from 'lucide-react';
import type { NewsLogEntry } from '@/lib/types';

const BREAKING_WINDOW_MS = 10 * 60 * 1000;

// Constant scroll speed in CSS pixels per second. Loop duration falls out of
// the actual rendered track width, so the strip always moves at this pace
// regardless of how many headlines news_log holds.
const PX_PER_SEC = 120;

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

export function NewsScreener({ items }: { items: NewsLogEntry[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const ordered = useMemo(() => {
    return [...items]
      .filter((it) => it.published_at != null)
      .sort((a, b) => {
        const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
        const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
        return tb - ta;
      });
  }, [items]);

  // Measure the track's rendered width and let it dictate the loop length.
  // The track contains two copies of `ordered`, so the keyframe slides by
  // -50% (one copy width) over `oneCopyWidth / PX_PER_SEC` seconds.
  const trackRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => {
      const oneCopyWidth = el.scrollWidth / 2;
      if (oneCopyWidth > 0) setDuration(oneCopyWidth / PX_PER_SEC);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ordered.length]);

  // Anchor the loop to wall-clock time so every viewer sees the same frame
  // and refreshes resume mid-stream. Recomputes when duration changes.
  const [animationDelay, setAnimationDelay] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (duration == null) return;
    setAnimationDelay(`-${(Date.now() / 1000) % duration}s`);
  }, [duration]);

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
        ref={trackRef}
        className="news-screener-track relative z-0 flex min-w-0 flex-1 items-stretch whitespace-nowrap"
        style={
          duration != null
            ? {
                animationDuration: `${duration}s`,
                ...(animationDelay ? { animationDelay } : {}),
              }
            : undefined
        }
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
