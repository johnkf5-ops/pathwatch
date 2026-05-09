'use client';
import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { getBrowserClient } from '@/lib/supabase-browser';

export function LiveVisitorCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const sb = getBrowserClient();
    const presenceKey =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const channel = sb.channel('pathwatch-presence', {
      config: { presence: { key: presenceKey } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const total = Object.values(state).reduce<number>(
          (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
          0,
        );
        setCount(total);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ joined_at: Date.now() });
        }
      });

    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  if (count === null) return null;
  return (
    <span
      className="flex items-center gap-1.5"
      title={`${count} active session${count === 1 ? '' : 's'} on Pathwatch right now`}
    >
      <Eye size={11} />
      <span className="tabular-nums text-text">{count}</span>
      <span>VIEWING</span>
    </span>
  );
}
