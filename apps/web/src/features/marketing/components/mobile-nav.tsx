'use client';

import { ArrowRight, Menu } from 'lucide-react';
import Link from 'next/link';
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { NAV_LINKS } from '../content';
import { cta } from './marketing-ui';

type Cta = { href: string; label: string };

/** The section links collapse into a drawer below the desktop breakpoint. */
export function MobileNav({ primary, secondary }: { primary: Cta; secondary: Cta | null }) {
  return (
    <Drawer>
      <DrawerTrigger
        className="grid size-10 place-items-center rounded-lg text-white transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sidebar-accent lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" aria-hidden />
      </DrawerTrigger>
      <DrawerContent title="Menu" side="right">
        <nav aria-label="Sections" className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
          {NAV_LINKS.map((link) => (
            <DrawerClose asChild key={link.href}>
              <a
                href={link.href}
                className="rounded-lg px-3 py-3 text-lg font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                {link.label}
              </a>
            </DrawerClose>
          ))}
        </nav>
        <div className="space-y-3 border-t border-border p-4">
          {secondary ? (
            <DrawerClose asChild>
              <Link href={secondary.href} className={cn(cta.onLight, 'w-full')}>
                {secondary.label}
              </Link>
            </DrawerClose>
          ) : null}
          <DrawerClose asChild>
            <Link href={primary.href} className={cn(cta.primary, 'w-full')}>
              {primary.label}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
