import * as React from 'react';
import { cn } from '@/lib/utils';

export type TimelineTone = 'neutral' | 'success' | 'danger' | 'primary' | 'pending';

export type TimelineItem = {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  time?: React.ReactNode;
  tone?: TimelineTone;
  icon?: React.ReactNode;
};

const dotTone: Record<TimelineTone, string> = {
  neutral: 'border-border-strong bg-surface text-muted-foreground',
  success: 'border-approved bg-approved-subtle text-approved',
  danger: 'border-rejected bg-rejected-subtle text-rejected',
  primary: 'border-primary bg-primary-subtle text-primary',
  pending: 'border-pending bg-pending-subtle text-pending',
};

/** Vertical event list with a connecting rail. */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn('relative', className)}>
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
          {index < items.length - 1 ? (
            <span
              className="absolute left-[9px] top-5 h-[calc(100%-1.25rem)] w-px bg-border"
              aria-hidden
            />
          ) : null}
          <span
            className={cn(
              'relative z-10 mt-0.5 flex size-[19px] shrink-0 items-center justify-center rounded-full border-2 [&_svg]:size-2.5',
              dotTone[item.tone ?? 'neutral'],
            )}
            aria-hidden
          >
            {item.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-medium">{item.title}</p>
              {item.time ? <p className="text-xs text-muted-foreground">{item.time}</p> : null}
            </div>
            {item.description ? (
              <div className="mt-0.5 text-sm text-muted-foreground">{item.description}</div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
