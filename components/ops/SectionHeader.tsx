import { cn } from '@/lib/utils';

export function SectionHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        'font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-text-secondary',
        className,
      )}
    >
      {children}
    </h2>
  );
}
