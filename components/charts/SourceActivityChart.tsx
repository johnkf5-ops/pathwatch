'use client';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { Event, SourceType } from '@/lib/types';
import { Card } from '@/components/ui/Card';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const LABEL: Record<SourceType, string> = {
  who: 'WHO',
  cdc: 'CDC',
  ecdc: 'ECDC',
  africa_cdc: 'Africa CDC',
  google_news: 'Google',
  reddit: 'Reddit',
  x: 'X',
  bluesky: 'BlueSky',
  wikipedia: 'Wiki',
};

interface BarPoint {
  source: string;
  count: number;
}

export function SourceActivityChart({ events }: { events: Event[] }) {
  const bars = useMemo<BarPoint[]>(() => {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const counts = new Map<SourceType, number>();
    for (const e of events) {
      const ts = new Date(e.occurred_at ?? e.created_at).getTime();
      if (ts < cutoff) continue;
      counts.set(e.source_type, (counts.get(e.source_type) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([source, count]) => ({ source: LABEL[source], count }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  if (bars.length === 0) {
    return (
      <Card data-testid="source-activity-chart">
        <h3 className="mb-2 text-sm font-semibold text-text">Source activity (last 7 days)</h3>
        <p className="text-xs text-text-muted">No source activity in the last 7 days.</p>
      </Card>
    );
  }

  return (
    <Card data-testid="source-activity-chart">
      <h3 className="mb-3 text-sm font-semibold text-text">Source activity (last 7 days)</h3>
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="#2A2A35" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="source" tick={{ fill: '#8888A0', fontSize: 11 }} stroke="#2A2A35" />
            <YAxis tick={{ fill: '#8888A0', fontSize: 11 }} stroke="#2A2A35" allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#12121A', border: '1px solid #2A2A35', borderRadius: 8 }}
              cursor={{ fill: '#1A1A25' }}
            />
            <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
