import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

export type EmptyStateProps = {
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
};

/** Explains what belongs here and what to do next. Never a bare "No data". */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-1.5 px-4 py-8' : 'gap-2 px-6 py-16',
        className,
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-xl bg-surface text-subtle-foreground shadow-card ring-1 ring-border',
          compact ? 'size-10' : 'mb-1 size-12',
        )}
        aria-hidden
      >
        <Icon className={compact ? 'size-[18px]' : 'size-5'} strokeWidth={1.75} />
      </span>
      <h3 className="mt-1 text-base font-semibold">{title}</h3>
      {description ? (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
