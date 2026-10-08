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
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
      {item.planned && !collapsed ? (
        <span className="ml-auto rounded-sm border border-sidebar-border px-1 text-2xs text-sidebar-muted">
          Planned
        </span>
      ) : null}
    </>
  );
  const base = 'relative flex h-8 items-center gap-2.5 rounded px-2.5 text-sm transition-colors';
  const element = item.planned ? (
    <span aria-disabled="true" className={cn(base, 'cursor-not-allowed text-sidebar-muted/70')}>
      {content}
    </span>
  ) : (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        base,
        'hover:bg-sidebar-active hover:text-white',
        active ? 'bg-sidebar-active font-medium text-white' : 'text-sidebar-foreground',
      )}
    >
      {active ? (
        <span
          className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-accent"
          aria-hidden
        />
      ) : null}
      {content}
    </Link>
  );
  return collapsed ? (
    <Tooltip content={item.label} side="right">
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
    <nav aria-label="Main" className="scroll-thin flex-1 space-y-4 overflow-y-auto px-2 py-3">
      {groups.map((group, groupIndex) => (
        <div key={group.id}>
          {collapsed ? (
            groupIndex > 0 ? (
              <div className="mx-2 mb-1.5 border-t border-sidebar-border" aria-hidden />
            ) : null
          ) : (
            <p className="mb-1 px-2.5 text-2xs font-medium uppercase tracking-wider text-sidebar-muted">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
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
        'hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-150 md:flex print:hidden',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
      )}
    >
      <div
        className={cn(
          'flex h-topbar shrink-0 items-center gap-2.5 border-b border-sidebar-border',
          collapsed ? 'justify-center' : 'px-4',
        )}
      >
        <BrandMark className="size-6" />
        {collapsed ? null : (
          <span className="text-base font-semibold tracking-tight text-white">ProBuild</span>
        )}
      </div>
      <SidebarNav collapsed={collapsed} pathname={pathname} />
      <div className="border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-8 w-full items-center gap-2.5 rounded px-2.5 text-sm text-sidebar-muted hover:bg-sidebar-active hover:text-white"
        >
          {collapsed ? (
            <ChevronsRight className="mx-auto size-4" aria-hidden />
          ) : (
            <ChevronsLeft className="size-4" aria-hidden />
          )}
          {collapsed ? null : <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
