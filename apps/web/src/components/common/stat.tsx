import { ArrowDownRight, ArrowUpRight, ChevronRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type StatTone = 'primary' | 'accent' | 'violet' | 'pending' | 'warning' | 'danger' | 'success' | 'neutral';

const ICON_TONES: Record<StatTone, string> = {
  primary: 'bg-primary-subtle text-primary',
  accent: 'bg-accent-subtle text-accent-strong',
  violet: 'bg-violet-subtle text-violet',
  pending: 'bg-pending-subtle text-pending',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
  success: 'bg-success-subtle text-success',
  neutral: 'bg-surface-muted text-muted-foreground',
};

export type StatProps = {
  label: string;
  value: React.ReactNode;
  /** Secondary line, e.g. the comparison basis. */
  hint?: React.ReactNode;
  /** Signed change with its own tone; omit when there is no real comparison. */
  delta?: { text: string; direction: 'up' | 'down'; good: boolean };
  href?: string;
  loading?: boolean;
  icon?: LucideIcon;
  /** Tint for the icon tile; the figure itself stays neutral so colour never replaces the number. */
  tone?: StatTone;
  className?: string;
};

/** KPI block: label and icon on top, tabular value, one line of context. */
export function Stat({
  label,
  value,
  hint,
  delta,
  href,
  loading,
  icon: Icon,
  tone = 'neutral',
  className,
}: StatProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span
            className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', ICON_TONES[tone])}
            aria-hidden
          >
            <Icon className="size-3.5" strokeWidth={2} />
          </span>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <p className={cn('num font-semibold leading-none tracking-tight', Icon ? 'mt-1 text-[1.75rem]' : 'mt-2 text-[1.75rem]')}>
          {value}
        </p>
      )}
      {hint || delta ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
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
          <span className="min-w-0 flex-1 truncate">{hint}</span>
          {href ? (
            <ChevronRight
              className="size-3.5 shrink-0 text-subtle-foreground transition-transform group-hover/stat:translate-x-0.5 group-hover/stat:text-primary"
              aria-hidden
            />
          ) : null}
        </p>
      ) : null}
    </>
  );
  const classes = cn(
    'group/stat block rounded-xl border border-border bg-surface px-4 py-3.5 shadow-card',
    href &&
      'outline-none transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-lift focus-visible:ring-2 focus-visible:ring-ring',
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
