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
        compact ? 'gap-1.5 px-4 py-8' : 'gap-2 px-6 py-14',
        className,
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface-muted text-muted-foreground">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <h3 className="mt-1 text-base font-semibold">{title}</h3>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
