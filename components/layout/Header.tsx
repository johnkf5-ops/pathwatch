import Link from 'next/link';
import { LiveIndicator } from '@/components/ui/LiveIndicator';

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold tracking-tight">Pathwatch</span>
          <LiveIndicator />
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/about" className="text-text-secondary hover:text-text">About</Link>
        </nav>
      </div>
    </header>
  );
}
