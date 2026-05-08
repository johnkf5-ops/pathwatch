import * as React from 'react';
import { cn } from '@/lib/utils';

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-x-auto">
      <table ref={ref} className={cn('w-full text-sm', className)} {...props} />
    </div>
  ),
);
Table.displayName = 'Table';

export const Thead = (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className="border-b border-border text-text-secondary" {...props} />
);

export const Tbody = (props: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...props} />;

export const Tr = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('border-b border-border last:border-0 hover:bg-surface-hover', className)} {...props} />
);

export const Th = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn('h-10 px-3 text-left font-medium', className)} {...props} />
);

export const Td = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-3 py-2', className)} {...props} />
);
