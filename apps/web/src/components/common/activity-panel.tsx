'use client';

import { History } from 'lucide-react';
import * as React from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { Timeline, type TimelineItem, type TimelineTone } from '@/components/common/timeline';
import { Skeleton } from '@/components/ui/skeleton';
import type { ActivityItem } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';

function toneOf(item: ActivityItem): TimelineTone {
  const action = item.action.toUpperCase();
  if (action.includes('REJECT') || action.includes('CANCEL')) return 'danger';
  if (action.includes('APPROVE') || action.includes('AWARD')) return 'success';
  if (action.includes('SUBMIT') || action.includes('SEND')) return 'pending';
  return 'neutral';
}

/** Audit and approval history of a record, newest first, as the API returns it. */
export function ActivityPanel({
  items,
  loading,
  error,
  onRetry,
}: {
  items: ActivityItem[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading activity">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-10" />
        ))}
      </div>
    );
  }
  if (error) return <QueryErrorState error={error} {...(onRetry ? { onRetry } : {})} compact />;
  if (!items || items.length === 0) {
    return (
      <EmptyState
        compact
        icon={History}
        title="No activity yet"
        description="Changes and decisions on this record are listed here as they happen."
      />
    );
  }
  const entries: TimelineItem[] = items.map((item) => ({
    id: item.id,
    title: item.summary,
    time: <time dateTime={item.at}>{formatDateTime(item.at)}</time>,
    tone: toneOf(item),
    description: (
      <>
        <span>{item.actor?.name ?? 'System'}</span>
        {item.reason ? <span> · “{item.reason}”</span> : null}
      </>
    ),
  }));
  return <Timeline items={entries} />;
}
