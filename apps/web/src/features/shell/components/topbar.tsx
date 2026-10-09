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
        className="text-muted-foreground hover:text-foreground"
      >
        <Bell className="size-[18px]" strokeWidth={1.75} aria-hidden />
      </IconButton>
      {unread > 0 ? (
        <span
          className="num pointer-events-none absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.625rem] font-semibold leading-none text-white ring-2 ring-surface"
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
    <header className="flex h-topbar shrink-0 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 md:gap-3 md:px-5 print:hidden">
      <IconButton label="Open navigation" onClick={onOpenMenu} className="md:hidden">
        <Menu className="size-[18px]" aria-hidden />
      </IconButton>
      <ContextBar />
      <div className="ml-auto flex items-center gap-1.5 md:gap-2">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-8 w-9 items-center justify-center gap-2 rounded-lg border border-border bg-surface-muted text-sm text-subtle-foreground outline-none transition-colors hover:border-border-strong hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:w-56 sm:justify-start sm:px-2.5 xl:w-72"
          aria-label="Search (Ctrl K)"
        >
          <Search className="size-3.5 shrink-0" aria-hidden />
          <span className="hidden flex-1 text-left sm:inline">Search or jump to…</span>
          <span className="hidden items-center gap-0.5 sm:flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
        <NotificationsBell onClick={onOpenNotifications} />
        <span className="mx-0.5 hidden h-5 w-px bg-border sm:block" aria-hidden />
        <UserMenu onShowShortcuts={onShowShortcuts} />
      </div>
    </header>
  );
}
