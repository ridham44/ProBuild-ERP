import * as React from 'react';
import { cn } from '@/lib/utils';

/** Plain table primitives. Use DataTable for interactive lists; these suit small static tables. */
export const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(function Table({ className, ...props }, ref) {
  return (
    <table
      ref={ref}
      className={cn('w-full border-separate border-spacing-0 text-sm', className)}
      {...props}
    />
  );
});

export function TableHead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-surface-muted', className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&>tr:last-child>td]:border-b-0', className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'group/row transition-colors hover:bg-surface-muted data-[state=selected]:bg-primary-subtle',
        className,
      )}
      {...props}
    />
  );
}

export function TableHeaderCell({
  className,
  numeric,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        'whitespace-nowrap border-b border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground first:pl-4 last:pr-4',
        numeric ? 'text-right' : 'text-left',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  numeric,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'border-b border-border/70 px-3 py-2.5 align-middle first:pl-4 last:pr-4',
        numeric && 'num text-right',
        className,
      )}
      {...props}
    />
  );
}
