'use client';
import { Drawer } from 'vaul';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import type { Case, CaseLocation, Event } from '@/lib/types';
import { CaseDossier } from './CaseDossier';

interface Props {
  cases: Case[];
  caseLocations: CaseLocation[];
  events: Event[];
  caseCode: string | null;
}

export function CaseDossierSheet({ cases, caseLocations, events, caseCode }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const open = caseCode != null;
  const c = caseCode ? cases.find((x) => x.case_code === caseCode) ?? null : null;
  const sourceEvent = c?.source_event_id ? events.find((e) => e.id === c.source_event_id) ?? null : null;

  function close() {
    const u = new URLSearchParams(searchParams.toString());
    u.delete('case');
    const qs = u.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => { if (!o) close(); }}
      snapPoints={[0.3, 0.55, 0.85]}
      activeSnapPoint={open ? 0.55 : null}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Drawer.Content
          data-testid="dossier-sheet"
          className="fixed inset-x-0 bottom-0 z-50 flex h-[90vh] flex-col rounded-t-[8px] border-t border-border-strong bg-surface-2 outline-none"
        >
          <Drawer.Title className="sr-only">Case dossier</Drawer.Title>
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
          <div className="flex items-center justify-between px-4 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">DOSSIER</span>
            <button
              type="button"
              onClick={close}
              aria-label="Close dossier"
              className="inline-flex h-6 w-6 items-center justify-center rounded text-text-muted hover:text-text"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {c ? (
              <CaseDossier case_={c} locations={caseLocations} sourceEvent={sourceEvent} showOpenLink />
            ) : (
              <p className="px-4 py-6 text-center text-sm text-text-muted">Case not found.</p>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
