import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
  const variants = {
    default: 'bg-surface-hover text-text-secondary',
    outline: 'border border-border text-text-secondary',
  };
  return <span className={cn(base, variants[variant], className)} {...props} />;
}
