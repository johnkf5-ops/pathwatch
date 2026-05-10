import { Globe2, Building2, MessageSquare, Newspaper, BookOpen, Hash, Bird, type LucideIcon } from 'lucide-react';
import type { SourceType } from '@/lib/types';

const ICONS: Record<SourceType, LucideIcon> = {
  who: Globe2,
  cdc: Building2,
  ecdc: Building2,
  africa_cdc: Building2,
  google_news: Newspaper,
  reddit: Hash,
  x: MessageSquare,
  bluesky: Bird,
  wikipedia: BookOpen,
};

const TYPE_LABEL: Record<SourceType, string> = {
  who: 'WHO',
  cdc: 'CDC',
  ecdc: 'ECDC',
  africa_cdc: 'Africa CDC',
  google_news: 'Google News',
  reddit: 'Reddit',
  x: 'X',
  bluesky: 'BlueSky',
  wikipedia: 'Wikipedia',
};

// Shows the real publication when present (`label`, typically from
// `events.source_author`), falling back to the source-type label.
// The icon is always the source-type generic — the publication name
// carries the specificity, the icon carries the kind-of-source signal.
export function SourceIcon({ source, label }: { source: SourceType; label?: string | null }) {
  const Icon = ICONS[source];
  const displayLabel = label?.trim() || TYPE_LABEL[source];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
      <Icon size={14} />
      <span>{displayLabel}</span>
    </span>
  );
}
