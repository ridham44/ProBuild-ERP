import * as React from 'react';
import { cn } from '@/lib/utils';

/** A bordered section with a quiet header. Used for the blocks inside detail pages. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-border bg-surface shadow-card', className)}>
      {title || actions ? (
        <header className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-2.5">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold tracking-tight">{title}</h2> : null}
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export type DetailItem = {
  label: string;
  value: React.ReactNode;
  /** Right-align with tabular numerals (money, quantities). */
  numeric?: boolean;
  wide?: boolean;
};

/** Label/value pairs as a definition list, three columns on wide screens. */
export function DetailList({
  items,
  columns = 3,
  className,
}: {
  items: DetailItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const grid =
    columns === 2
      ? 'sm:grid-cols-2'
      : columns === 4
        ? 'sm:grid-cols-2 lg:grid-cols-4'
        : 'sm:grid-cols-2 lg:grid-cols-3';
  return (
    <dl className={cn('grid gap-x-8 gap-y-4 text-sm', grid, className)}>
      {items.map((item) => (
        <div key={item.label} className={cn('min-w-0', item.wide && 'sm:col-span-2')}>
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className={cn('mt-1 break-words font-medium text-foreground', item.numeric && 'num')}>
            {item.value === null || item.value === undefined || item.value === ''
              ? '—'
              : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
