'use client';

import { BellOff, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { QueryErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import type { NotificationDto } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '../api/hooks';
import { groupByDay } from '../presentation';
import { NotificationRow } from './notification-row';

/** Notification types that point at a screen that exists today. Others are shown but not linked. */
export function notificationHref(notification: NotificationDto): string | null {
  return notification.type.startsWith('APPROVAL') ? '/approvals' : null;
}

export function NotificationsDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const query = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unread = query.data?.unread ?? 0;

  function openNotification(notification: NotificationDto): void {
    if (!notification.readAt) markRead.mutate(notification.id);
    const href = notificationHref(notification);
    if (href) {
      onOpenChange(false);
      router.push(href);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : 'Everything is read'}
      >
        <div className="flex items-center justify-between border-b border-border bg-surface-muted px-4 py-2">
          <span className="text-xs text-muted-foreground">
            {unread > 0 ? `${unread} unread` : 'You are all caught up'}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => markAll.mutate()}
            disabled={unread === 0}
            loading={markAll.isPending}
          >
            <CheckCheck className="size-3.5" aria-hidden />
            Mark all read
          </Button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto">
          {query.isPending ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <QueryErrorState
              error={query.error}
              onRetry={() => void query.refetch()}
              retrying={query.isFetching}
              compact
            />
          ) : query.data.items.length === 0 ? (
            <EmptyState
              compact
              icon={BellOff}
              title="No notifications yet"
              description="Approval requests and decisions that involve you show up here."
            />
          ) : (
            <div className="pb-4">
              {groupByDay(query.data.items).map((group) => (
                <section key={group.label} aria-label={group.label}>
                  <h3 className="eyebrow sticky top-0 z-[1] border-b border-border bg-surface-raised/95 px-4 py-2 backdrop-blur">
                    {group.label}
                  </h3>
                  <ul>
                    {group.items.map((notification) => (
                      <li key={notification.id}>
                        <button
                          type="button"
                          onClick={() => openNotification(notification)}
                          className={cn(
                            'flex w-full items-start gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                            !notification.readAt && 'bg-primary-subtle/40',
                          )}
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
        </div>
      </DrawerContent>
    </Drawer>
  );
}
