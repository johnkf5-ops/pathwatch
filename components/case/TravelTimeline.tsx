import { format, parseISO } from 'date-fns';
import type { CaseLocation } from '@/lib/types';
import { CountryFlag } from '@/components/ui/CountryFlag';

export function TravelTimeline({ stops }: { stops: CaseLocation[] }) {
  if (stops.length === 0) {
    return <p className="text-sm text-text-muted">No travel data.</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {stops.map((s, i) => {
        const arrived = format(parseISO(s.arrived_at), 'MMM d');
        const departed = s.departed_at ? format(parseISO(s.departed_at), 'MMM d') : 'PRESENT';
        return (
          <li key={s.id} className="flex gap-3 border-l border-border-soft pl-3">
            <div className="flex flex-col">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
                STOP {i + 1} · {arrived} → {departed}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-sm text-text">
                <CountryFlag code={s.country_code} />
                <span>{s.location_name ?? s.country_code}</span>
                {s.is_exposure_site && (
                  <span className="ml-2 border border-red px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-red">
                    EXPOSURE
                  </span>
                )}
              </span>
              {s.context && <span className="mt-0.5 text-xs text-text-secondary">{s.context}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
