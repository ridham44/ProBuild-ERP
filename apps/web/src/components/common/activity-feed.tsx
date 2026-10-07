import Link from 'next/link';
import * as React from 'react';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

export type ActivityEntry = {
  id: string;
  /** Who did it, or the system. */
  actor: string;
  /** Verb phrase, e.g. "approved" or "raised". */
  action: string;
  target?: string;
  href?: string;
  at: string;
  unread?: boolean;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function ActivityFeed({
  entries,
  className,
}: {
  entries: ActivityEntry[];
  className?: string;
}) {
  return (
    <ul className={cn('divide-y divide-border', className)}>
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
          <span
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded bg-surface-muted text-2xs font-semibold text-muted-foreground"
            aria-hidden
          >
            {initials(entry.actor) || '·'}
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p>
              <span className="font-medium">{entry.actor}</span>{' '}
              <span className="text-muted-foreground">{entry.action}</span>{' '}
              {entry.target ? (
                entry.href ? (
                  <Link href={entry.href} className="font-medium text-primary hover:underline">
                    {entry.target}
                  </Link>
                ) : (
                  <span className="font-medium">{entry.target}</span>
                )
              ) : null}
            </p>
            <time
              dateTime={entry.at}
              title={formatDateTime(entry.at)}
              className="text-xs text-muted-foreground"
            >
              {formatRelative(entry.at)}
            </time>
          </div>
          {entry.unread ? (
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
