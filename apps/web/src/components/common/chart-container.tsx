'use client';

import dynamic from 'next/dynamic';
import * as React from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type ChartContainerProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** True when the query succeeded but there is nothing to plot. */
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  heightClassName?: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Frame for a real chart. It owns the title, loading, error and empty states so every chart looks the
 * same; the chart itself is passed in and should be loaded with `lazyChart` so the library stays out of
 * the initial bundle. No chart library is installed yet because no screen has data to plot.
 */
export function ChartContainer({
  title,
  description,
  actions,
  loading,
  error,
  onRetry,
  empty,
  emptyTitle = 'Nothing to chart yet',
  emptyDescription = 'This chart fills in as transactions are recorded.',
  heightClassName = 'h-64',
  children,
  className,
}: ChartContainerProps) {
  return (
    <section
      className={cn('rounded-lg border border-border bg-surface', className)}
      aria-label={title}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-2.5">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </header>
      <div className={cn('p-4', heightClassName)}>
        {loading ? (
          <Skeleton className="size-full" />
        ) : error ? (
          <QueryErrorState error={error} {...(onRetry ? { onRetry } : {})} compact />
        ) : empty ? (
          <EmptyState compact title={emptyTitle} description={emptyDescription} />
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/** Lazy-loads a chart component on the client only, with a skeleton while its code downloads. */
export function lazyChart<P extends object>(
  loader: () => Promise<{ default: React.ComponentType<P> }>,
) {
  return dynamic(loader, { ssr: false, loading: () => <Skeleton className="size-full" /> });
}
