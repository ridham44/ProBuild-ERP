import type { NotificationDto } from '@/lib/api/types';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { notificationLook } from '../presentation';

/** Icon tile, title, body and time for one notification. The caller decides whether it is a button or plain row. */
export function NotificationRow({ notification }: { notification: NotificationDto }) {
  const { icon: Icon, className } = notificationLook(notification.type);
  const unread = !notification.readAt;
  return (
    <>
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg',
          className,
          !unread && 'opacity-70',
        )}
        aria-hidden
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-sm leading-snug',
            unread ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}
        >
          {notification.title}
        </span>
        {notification.body ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">{notification.body}</span>
        ) : null}
        <span className="mt-1 block text-2xs text-subtle-foreground">
          {formatRelative(notification.createdAt)}
        </span>
      </span>
      {unread ? (
        <>
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
          <span className="sr-only">Unread</span>
        </>
      ) : null}
    </>
  );
}
