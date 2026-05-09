import { ImageResponse } from 'next/og';
import { createServerClient } from '@/lib/supabase-server';

export const alt = 'Pathwatch — Real-Time Disease Outbreak Tracker';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Skip build-time prerender — needs runtime Supabase env vars.
export const dynamic = 'force-dynamic';

export default async function Image() {
  const supabase = createServerClient();
  const { data: snap } = await supabase
    .from('snapshots')
    .select('total_cases, total_deaths, countries_affected, risk_level')
    .eq('disease', 'hantavirus')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const cases = snap?.total_cases ?? '—';
  const deaths = snap?.total_deaths ?? '—';
  const countries = snap?.countries_affected ?? '—';
  const risk = (snap?.risk_level ?? 'unknown').toUpperCase();
  const riskColor =
    snap?.risk_level === 'critical' ? '#FF3B3B'
    : snap?.risk_level === 'high' ? '#FF6B35'
    : snap?.risk_level === 'moderate' ? '#FFB800'
    : snap?.risk_level === 'low' ? '#4ADE80'
    : '#8888A0';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '64px',
          background: '#0A0A0F',
          color: '#E8E8ED',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: '#4ADE80' }} />
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em' }}>Pathwatch</div>
        </div>

        <div style={{ marginTop: 48, fontSize: 28, color: '#8888A0' }}>
          Real-Time Disease Outbreak Tracker
        </div>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            gap: 48,
            alignItems: 'flex-end',
          }}
        >
          <Stat label="CASES" value={String(cases)} />
          <Stat label="DEATHS" value={String(deaths)} />
          <Stat label="COUNTRIES" value={String(countries)} />
          <div
            style={{
              marginLeft: 'auto',
              padding: '12px 20px',
              borderRadius: 10,
              border: `2px solid ${riskColor}`,
              color: riskColor,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            {`RISK: ${risk}`}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 16, color: '#8888A0', letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.04em' }}>
        {value}
      </div>
    </div>
  );
}
