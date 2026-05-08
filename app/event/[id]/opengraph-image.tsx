import { ImageResponse } from 'next/og';
import { createServerClient } from '@/lib/supabase-server';
import { countryFlag } from '@/lib/format';

export const alt = 'Pathwatch event';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SIG_COLOR: Record<number, string> = {
  1: '#6B7280',
  2: '#4ADE80',
  3: '#FFB800',
  4: '#FF6B35',
  5: '#FF3B3B',
};

const SIG_LABEL: Record<number, string> = {
  1: 'ROUTINE',
  2: 'LOW',
  3: 'NOTABLE',
  4: 'HIGH',
  5: 'CRITICAL',
};

export default async function Image({ params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: event } = await supabase
    .from('events')
    .select('title, source_type, country_code, location_name, significance')
    .eq('id', params.id)
    .maybeSingle();

  const title = event?.title ?? 'Event';
  const source = (event?.source_type ?? '').toUpperCase().replace('_', ' ');
  const flag = countryFlag(event?.country_code ?? null);
  const location = event?.location_name ?? event?.country_code ?? '';
  const sig = (event?.significance as 1 | 2 | 3 | 4 | 5 | undefined) ?? 1;

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
          <div style={{ fontSize: 28, fontWeight: 700 }}>Pathwatch</div>
          <div style={{ marginLeft: 'auto', fontSize: 18, color: '#8888A0' }}>{source}</div>
        </div>

        <div
          style={{
            marginTop: 48,
            fontSize: 56,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            display: 'flex',
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 24,
          }}
        >
          {flag && <div style={{ fontSize: 56 }}>{flag}</div>}
          {location && (
            <div style={{ fontSize: 28, color: '#8888A0' }}>{location}</div>
          )}
          <div
            style={{
              marginLeft: 'auto',
              padding: '12px 20px',
              borderRadius: 10,
              border: `2px solid ${SIG_COLOR[sig]}`,
              color: SIG_COLOR[sig],
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '0.08em',
            }}
          >
            {SIG_LABEL[sig]}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
