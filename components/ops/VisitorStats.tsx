'use client';
import { useEffect, useState } from 'react';
import { Eye, Users } from 'lucide-react';
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

function formatTotal(n: number): string {
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function VisitorStats() {
  const [live, setLive] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    const sb = getBrowserClient();

    // 1) Live presence: in-memory channel, count of currently-connected sessions
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

    // 2) Cumulative: log this visitor (no-op if already logged), then read total + subscribe
    (async () => {
      const visitorId = getOrCreateVisitorId();
      if (visitorId) {
        // Insert; UNIQUE on visitor_id makes a repeat visit a 23505 error we ignore.
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null;
        await sb.from('visitor_log').insert({ visitor_id: visitorId, user_agent: ua });
      }
      const { count } = await sb.from('visitor_log').select('*', { count: 'exact', head: true });
      if (count != null) setTotal(count);
    })();

    // 3) Live increment of total when new visitors land
    const totalChannel = sb
      .channel('visitor-log-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'visitor_log' },
        () => setTotal((t) => (t == null ? 1 : t + 1)),
      )
      .subscribe();

    return () => {
      sb.removeChannel(presenceChannel);
      sb.removeChannel(totalChannel);
    };
  }, []);

  return (
    <>
      {live !== null && (
        <span
          className="flex items-center gap-1.5 border-l border-border pl-4"
          title={`${live} active session${live === 1 ? '' : 's'} on Pathwatch right now`}
        >
          <Eye size={11} />
          <span className="tabular-nums text-text">{live}</span>
          <span>VIEWING</span>
        </span>
      )}
      {total !== null && (
        <span
          className="flex items-center gap-1.5 border-l border-border pl-4"
          title={`${total.toLocaleString()} total visitors since launch`}
        >
          <Users size={11} />
          <span className="tabular-nums text-text">{formatTotal(total)}</span>
          <span>TOTAL</span>
        </span>
      )}
    </>
  );
}
