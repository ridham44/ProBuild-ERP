import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type StatProps = {
  label: string;
  value: React.ReactNode;
  /** Secondary line, e.g. the comparison basis. */
  hint?: React.ReactNode;
  /** Signed change with its own tone; omit when there is no real comparison. */
  delta?: { text: string; direction: 'up' | 'down'; good: boolean };
  href?: string;
  loading?: boolean;
  className?: string;
};

/** Compact KPI block: small label, tabular value, no decoration. */
export function Stat({ label, value, hint, delta, href, loading, className }: StatProps) {
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-6 w-20" />
      ) : (
        <p className="num mt-1 text-2xl font-semibold leading-none">{value}</p>
      )}
      {hint || delta ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {delta ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium',
                delta.good ? 'text-success' : 'text-danger',
              )}
            >
              {delta.direction === 'up' ? (
                <ArrowUpRight className="size-3" aria-hidden />
              ) : (
                <ArrowDownRight className="size-3" aria-hidden />
              )}
              {delta.text}
            </span>
          ) : null}
          {hint}
        </p>
      ) : null}
    </>
  );
  const classes = cn(
    'block rounded-lg border border-border bg-surface px-4 py-3',
    href && 'transition-colors hover:border-border-strong hover:bg-surface-muted/50',
    className,
  );
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
