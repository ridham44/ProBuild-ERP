'use client';

import { BellOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { Panel } from '@/components/common/panel';
import { SkeletonLines } from '@/components/ui/skeleton';
import { useMarkNotificationRead, useNotifications } from '@/features/notifications/api/hooks';
import { NotificationRow } from '@/features/notifications/components/notification-row';
import { notificationHref } from '@/features/notifications/components/notifications-drawer';
import { groupByDay } from '@/features/notifications/presentation';
import type { NotificationDto } from '@/lib/api/types';

const SHOWN = 8;

/** Recent notifications grouped by day; items that point at a screen open it and are marked read. */
export function NotificationFeed() {
  const router = useRouter();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const unread = notifications.data?.unread ?? 0;

  function open(notification: NotificationDto): void {
    if (!notification.readAt) markRead.mutate(notification.id);
    const href = notificationHref(notification);
    if (href) router.push(href);
  }

  return (
    <Panel
      title="Notifications"
      description={unread > 0 ? `${unread} unread` : 'You are all caught up'}
      bodyClassName="p-0"
    >
      {notifications.isPending ? (
        <SkeletonLines lines={5} className="p-5" />
      ) : notifications.isError ? (
        <QueryErrorState
          error={notifications.error}
          onRetry={() => void notifications.refetch()}
          compact
        />
      ) : notifications.data.items.length === 0 ? (
        <EmptyState
          compact
          icon={BellOff}
          title="No notifications yet"
          description="Approval requests, decisions and stock events that involve you show up here."
        />
      ) : (
        <div className="pb-2">
          {groupByDay(notifications.data.items.slice(0, SHOWN)).map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h3 className="eyebrow px-5 pb-1 pt-3">{group.label}</h3>
              <ul>
                {group.items.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => open(notification)}
                      className="flex w-full items-start gap-3 px-5 py-2.5 text-left outline-none transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <NotificationRow notification={notification} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Panel>
  );
}
