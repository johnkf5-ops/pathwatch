'use client';
import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { getBrowserClient } from '@/lib/supabase-browser';

const VISITOR_ID_KEY = 'pathwatch_visitor_id';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getOrCreateVisitorId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    let id = window.localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = newId();
      window.localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}


export function VisitorStats() {
  const [live, setLive] = useState<number | null>(null);

  useEffect(() => {
    const sb = getBrowserClient();

    // Live presence channel — count of currently-connected sessions
    const presenceChannel = sb.channel('pathwatch-presence', {
      config: { presence: { key: newId() } },
    });
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const count = Object.values(state).reduce<number>(
          (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
          0,
        );
        setLive(count);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await presenceChannel.track({ joined_at: Date.now() });
      });

    // Cumulative still logged to visitor_log (kept for analytics) — not displayed.
    (async () => {
      const visitorId = getOrCreateVisitorId();
      if (!visitorId) return;
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null;
      await sb.from('visitor_log').insert({ visitor_id: visitorId, user_agent: ua });
    })();

    return () => {
      sb.removeChannel(presenceChannel);
    };
  }, []);

  if (live === null) return null;
  return (
    <span
      className="flex items-center gap-1.5 border-l border-border pl-4"
      title={`${live} active session${live === 1 ? '' : 's'} on Pathwatch right now`}
    >
      <Eye size={11} />
      <span className="tabular-nums text-text">{live}</span>
      <span>VIEWING</span>
    </span>
  );
}
