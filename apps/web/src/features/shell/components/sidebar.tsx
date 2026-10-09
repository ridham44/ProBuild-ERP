'use client';

import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandMark } from '@/components/common/brand-mark';
import { Tooltip } from '@/components/ui/tooltip';
import { useCurrentUser } from '@/features/auth/components/current-user';
import { cn } from '@/lib/utils';
import { findNavItem, getVisibleNav, type VisibleNavItem } from '../nav-registry';

const SHOW_PLANNED =
  process.env.NEXT_PUBLIC_SHOW_PLANNED_NAV === 'true' && process.env.NODE_ENV !== 'production';

const SIDEBAR_FOCUS =
  'focus-visible:ring-2 focus-visible:ring-sidebar-accent focus-visible:ring-offset-0';

/** Logo block at the top of the desktop sidebar and the mobile navigation drawer. */
export function SidebarBrand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        'flex h-topbar shrink-0 items-center gap-3 border-b border-sidebar-border',
        collapsed ? 'justify-center' : 'px-4',
      )}
    >
      <BrandMark className="size-8 rounded-lg p-0.5 shadow-sm" />
      {collapsed ? null : (
        <div className="min-w-0 leading-none">
          <p className="text-[0.9375rem] font-semibold tracking-tight text-white">ProBuild</p>
          <p className="mt-1 text-2xs text-sidebar-muted">Construction ERP</p>
        </div>
      )}
    </div>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: VisibleNavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const content = (
    <>
      <Icon
        className={cn(
          'size-4 shrink-0 transition-colors',
          active ? 'text-sidebar-accent' : 'text-sidebar-muted group-hover/nav:text-sidebar-foreground',
        )}
        strokeWidth={1.75}
        aria-hidden
      />
      <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
      {item.planned && !collapsed ? (
        <span className="ml-auto rounded-full bg-sidebar-hover px-1.5 py-px text-2xs text-sidebar-muted">
          Soon
        </span>
      ) : null}
    </>
  );
  const base = cn(
    'group/nav relative flex h-8 items-center gap-2.5 rounded-md text-sm outline-none transition-colors',
    collapsed ? 'justify-center px-0' : 'px-2.5',
  );
  const element = item.planned ? (
    <span aria-disabled="true" className={cn(base, 'cursor-not-allowed text-sidebar-muted/60')}>
      {content}
    </span>
  ) : (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        base,
        SIDEBAR_FOCUS,
        active
          ? 'bg-sidebar-active font-medium text-white'
          : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-white',
      )}
    >
      {active ? (
        <span
          className={cn(
            'absolute inset-y-1.5 w-[3px] rounded-r-full bg-sidebar-accent',
            collapsed ? '-left-2' : '-left-3',
          )}
          aria-hidden
        />
      ) : null}
      {content}
    </Link>
  );
  return collapsed ? (
    <Tooltip content={item.planned ? `${item.label} (coming soon)` : item.label} side="right">
      {element}
    </Tooltip>
  ) : (
    element
  );
}

export type SidebarContentProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
  pathname: string;
};

/** Shared by the desktop sidebar and the mobile drawer. */
export function SidebarNav({ collapsed = false, onNavigate, pathname }: SidebarContentProps) {
  const user = useCurrentUser();
  const groups = getVisibleNav(user, { showPlanned: SHOW_PLANNED });
  const activeId = findNavItem(pathname)?.id;
  return (
    <nav
      aria-label="Main"
      className={cn(
        'scroll-thin flex-1 space-y-5 overflow-y-auto overflow-x-hidden py-4',
        collapsed ? 'px-2' : 'px-3',
      )}
    >
      {groups.map((group, groupIndex) => (
        <div key={group.id}>
          {collapsed ? (
            groupIndex > 0 ? (
              <div className="mx-1.5 mb-2 border-t border-sidebar-border" aria-hidden />
            ) : null
          ) : (
            <p className="mb-1.5 px-2.5 text-2xs font-semibold uppercase tracking-[0.1em] text-sidebar-muted/80">
              {group.label}
            </p>
          )}
          <ul className="space-y-px">
            {group.items.map((item) => (
              <li key={item.id}>
                <NavLink
                  item={item}
                  active={item.id === activeId}
                  collapsed={collapsed}
                  {...(onNavigate ? { onNavigate } : {})}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out md:flex print:hidden',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
      )}
    >
      <SidebarBrand collapsed={collapsed} />
      <SidebarNav collapsed={collapsed} pathname={pathname} />
      <div className={cn('border-t border-sidebar-border py-2', collapsed ? 'px-2' : 'px-3')}>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex h-8 w-full items-center gap-2.5 rounded-md text-sm text-sidebar-muted outline-none transition-colors hover:bg-sidebar-hover hover:text-white',
            SIDEBAR_FOCUS,
            collapsed ? 'justify-center' : 'px-2.5',
          )}
        >
          {collapsed ? (
            <ChevronsRight className="size-4" strokeWidth={1.75} aria-hidden />
          ) : (
            <ChevronsLeft className="size-4" strokeWidth={1.75} aria-hidden />
          )}
          {collapsed ? null : <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
