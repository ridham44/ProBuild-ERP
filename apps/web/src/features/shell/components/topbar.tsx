'use client';

import { Bell, Menu, Search } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { useNotifications } from '@/features/notifications/api/hooks';
import { ContextBar } from './context-bar';
import { UserMenu } from './user-menu';

type TopbarProps = {
  onOpenMenu: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onShowShortcuts: () => void;
};

function NotificationsBell({ onClick }: { onClick: () => void }) {
  const { data } = useNotifications();
  const unread = data?.unread ?? 0;
  return (
    <div className="relative">
      <IconButton
        label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        onClick={onClick}
      >
        <Bell className="size-4" aria-hidden />
      </IconButton>
      {unread > 0 ? (
        <span
          className="num pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-semibold text-primary-foreground"
          aria-hidden
        >
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </div>
  );
}

export function Topbar({
  onOpenMenu,
  onOpenSearch,
  onOpenNotifications,
  onShowShortcuts,
}: TopbarProps) {
  return (
    <header className="flex h-topbar shrink-0 items-center gap-2 border-b border-border bg-surface px-3 md:px-4 print:hidden">
      <IconButton label="Open navigation" onClick={onOpenMenu} className="md:hidden">
        <Menu className="size-4" aria-hidden />
      </IconButton>
      <ContextBar />
      <button
        type="button"
        onClick={onOpenSearch}
        className="ml-auto flex h-8 w-9 items-center justify-center gap-2 rounded border border-border bg-surface-muted/60 text-sm text-muted-foreground hover:border-border-strong hover:text-foreground sm:w-64 sm:justify-start sm:px-2.5"
        aria-label="Search (Ctrl K)"
      >
        <Search className="size-3.5 shrink-0" aria-hidden />
        <span className="hidden flex-1 text-left sm:inline">Search</span>
        <span className="hidden items-center gap-0.5 sm:flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <NotificationsBell onClick={onOpenNotifications} />
      <UserMenu onShowShortcuts={onShowShortcuts} />
    </header>
  );
}
