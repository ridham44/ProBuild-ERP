'use client';

import { BellOff, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { QueryErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import type { NotificationDto } from '@/lib/api/contract';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '../api/hooks';

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
        <div className="flex items-center justify-end border-b border-border px-4 py-2">
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
            <ul className="divide-y divide-border">
              {query.data.items.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-muted/60"
                  >
                    <span
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        notification.readAt ? 'bg-transparent' : 'bg-primary',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block text-sm',
                          notification.readAt ? 'text-muted-foreground' : 'font-medium',
                        )}
                      >
                        {notification.title}
                      </span>
                      {notification.body ? (
                        <span className="block text-xs text-muted-foreground">
                          {notification.body}
                        </span>
                      ) : null}
                      <span className="mt-0.5 block text-xs text-subtle-foreground">
                        {formatRelative(notification.createdAt)}
                      </span>
                    </span>
                    {notification.readAt ? null : <span className="sr-only">Unread</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
