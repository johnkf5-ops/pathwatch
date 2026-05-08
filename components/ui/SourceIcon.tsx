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

const LABEL: Record<SourceType, string> = {
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

export function SourceIcon({ source }: { source: SourceType }) {
  const Icon = ICONS[source];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
      <Icon size={14} />
      <span>{LABEL[source]}</span>
    </span>
  );
}
