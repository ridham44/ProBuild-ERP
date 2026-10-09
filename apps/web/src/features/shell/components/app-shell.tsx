'use client';

import type { SessionUser } from '@probuild/shared';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { PageModuleProvider } from '@/components/common/page-module';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useMe } from '@/features/auth/api/hooks';
import { CurrentUserProvider } from '@/features/auth/components/current-user';
import { WorkContextProvider } from '@/features/context/work-context';
import { NotificationsDrawer } from '@/features/notifications/components/notifications-drawer';
import { CommandPalette } from '@/features/search/components/command-palette';
import { useRegisterDomainSearchProviders } from '@/features/search/domain-providers';
import { moduleForPath } from '../module-identity';
import { useGlobalShortcuts } from '../use-global-shortcuts';
import { Sidebar, SidebarBrand, SidebarNav } from './sidebar';
import { ShortcutsDialog } from './shortcuts-dialog';
import { Topbar } from './topbar';

const COLLAPSE_KEY = 'pb.sidebar.collapsed';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0');
  } catch {
    return;
  }
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);

  React.useEffect(() => setCollapsed(readCollapsed()), []);
  React.useEffect(() => setMobileOpen(false), [pathname]);

  const toggleSidebar = React.useCallback(() => {
    setCollapsed((current) => {
      writeCollapsed(!current);
      return !current;
    });
  }, []);
  const openPalette = React.useCallback(() => setPaletteOpen(true), []);
  const openHelp = React.useCallback(() => setHelpOpen(true), []);

  const pageModule = React.useMemo(() => moduleForPath(pathname), [pathname]);

  useGlobalShortcuts({ openPalette, openHelp, toggleSidebar });
  useRegisterDomainSearchProviders();

  return (
    <div className="flex h-dvh overflow-hidden bg-background print:block print:h-auto print:overflow-visible">
      <a
        href="#main"
        className="sr-only z-[70] rounded bg-surface px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <div className="flex min-w-0 flex-1 flex-col print:block">
        <Topbar
          onOpenMenu={() => setMobileOpen(true)}
          onOpenSearch={openPalette}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onShowShortcuts={openHelp}
        />
        <main id="main" tabIndex={-1} className="scroll-thin flex-1 overflow-y-auto outline-none print:overflow-visible">
          <div className="mx-auto w-full max-w-[1480px] px-4 py-5 md:px-6 md:py-6 lg:px-8"><PageModuleProvider value={pageModule}>{children}</PageModuleProvider>
          </div>
        </main>
      </div>

      <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
        <DrawerContent
          side="left"
          title="Navigation"
          hideHeader
          className="bg-sidebar text-sidebar-foreground"
        >
          <SidebarBrand />
          <SidebarNav pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </DrawerContent>
      </Drawer>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <NotificationsDrawer open={notificationsOpen} onOpenChange={setNotificationsOpen} />
      <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

export function AppShell({
  initialUser,
  children,
}: {
  initialUser: SessionUser;
  children: React.ReactNode;
}) {
  const me = useMe(initialUser);
  return (
    <CurrentUserProvider user={me.data ?? initialUser}>
      <WorkContextProvider>
        <ShellFrame>{children}</ShellFrame>
      </WorkContextProvider>
    </CurrentUserProvider>
  );
}
