import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-bg-2 px-4 py-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-5 gap-y-2">
        <span className="flex items-center gap-2">
          <span className="inline-flex h-3 w-3 items-center justify-center bg-green text-[9px] font-bold text-bg">P</span>
          <span className="font-bold tracking-[0.16em] text-text">PATHWATCH</span>
        </span>
        <Link href="/" className="hover:text-text">Tracker</Link>
        <Link href="/hantavirus" className="hover:text-text">Hantavirus</Link>
        <Link href="/faq" className="hover:text-text">FAQ</Link>
        <Link href="/facts" className="hover:text-text">Knowledge Base</Link>
        <Link href="/about" className="hover:text-text">About</Link>
        <span className="ml-auto normal-case tracking-normal text-text-muted/70">
          Situational awareness only — not medical advice.
        </span>
      </div>
    </footer>
  );
}
