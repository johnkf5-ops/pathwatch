'use client';
import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';
import type { Snapshot } from '@/lib/types';
import { Card } from '@/components/ui/Card';

interface Point {
  ts: string;
  cases: number;
}

export function TrendChart({ snapshots }: { snapshots: Snapshot[] }) {
  const points = useMemo<Point[]>(
    () =>
      snapshots
        .filter((s) => s.total_cases != null)
        .map((s) => ({ ts: s.created_at, cases: s.total_cases as number })),
    [snapshots],
  );

  if (points.length < 2) {
    return (
      <Card>
        <h3 className="mb-2 text-sm font-semibold text-text">Cases over time</h3>
        <p className="text-xs leading-relaxed text-text-muted">
          Need at least 2 snapshots for a trend. The pipeline produces one every 1–2 hours.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-text">Cases over time</h3>
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="#2A2A35" strokeDasharray="2 4" />
            <XAxis
              dataKey="ts"
              tickFormatter={(v) => format(parseISO(v), 'MMM d')}
              tick={{ fill: '#8888A0', fontSize: 11 }}
              stroke="#2A2A35"
            />
            <YAxis tick={{ fill: '#8888A0', fontSize: 11 }} stroke="#2A2A35" />
            <Tooltip
              contentStyle={{ background: '#12121A', border: '1px solid #2A2A35', borderRadius: 8 }}
              labelFormatter={(v) => format(parseISO(v as string), 'MMM d, HH:mm')}
            />
            <Line
              type="monotone"
              dataKey="cases"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ r: 3, fill: '#3B82F6' }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
