'use client';

import type { LucideIcon } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/** Accent family for a module. Used sparingly: the page icon tile and a few module-specific highlights. */
export type ModuleTone = 'navy' | 'primary' | 'accent' | 'violet' | 'neutral';

export type PageModule = { icon: LucideIcon; tone: ModuleTone; label: string };

const PageModuleContext = React.createContext<PageModule | null>(null);

/** The shell provides the module that owns the current route, so page headers need no per-page wiring. */
export function PageModuleProvider({
  value,
  children,
}: {
  value: PageModule | null;
  children: React.ReactNode;
}) {
  return <PageModuleContext.Provider value={value}>{children}</PageModuleContext.Provider>;
}

export function usePageModule(): PageModule | null {
  return React.useContext(PageModuleContext);
}

const TILE_TONES: Record<ModuleTone, string> = {
  navy: 'bg-sidebar text-white ring-sidebar-border',
  primary: 'bg-primary-subtle text-primary ring-primary-border',
  accent: 'bg-accent-subtle text-accent-strong ring-accent-border',
  violet: 'bg-violet-subtle text-violet ring-violet-border',
  neutral: 'bg-surface-muted text-muted-foreground ring-border',
};

export function ModuleIconTile({
  icon: Icon,
  tone,
  className,
}: {
  icon: LucideIcon;
  tone: ModuleTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
        TILE_TONES[tone],
        className,
      )}
      aria-hidden
    >
      <Icon className="size-5" strokeWidth={1.75} />
    </span>
  );
}
