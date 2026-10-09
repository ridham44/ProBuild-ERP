import Link from 'next/link';
import { BrandMark } from '@/components/common/brand-mark';
import { cn } from '@/lib/utils';
import { NAV_LINKS } from '../content';
import { Container } from './marketing-ui';
import { MobileNav } from './mobile-nav';

type Cta = { href: string; label: string };

export function HomeLogo({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <Link
      href="/home"
      className="flex shrink-0 items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:ring-sidebar-accent"
    >
      <BrandMark className="size-9 rounded-lg p-0.5" />
      <span className="leading-none">
        <span className={cn('block text-lg font-semibold tracking-tight', tone === 'dark' ? 'text-white' : 'text-foreground')}>
          ProBuild
        </span>
        <span className={cn('mt-1 block text-2xs', tone === 'dark' ? 'text-sidebar-muted' : 'text-subtle-foreground')}>
          Construction ERP
        </span>
      </span>
    </Link>
  );
}

/** Public navigation. Deliberately separate from the signed-in app shell. */
export function HomeNav({ primary, secondary }: { primary: Cta; secondary: Cta | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-sidebar/90 backdrop-blur-lg">
      <Container className="flex h-16 items-center gap-3">
        <HomeLogo />
        <nav aria-label="Sections" className="ml-8 hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-[0.9375rem] font-medium text-sidebar-foreground transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {secondary ? (
            <Link
              href={secondary.href}
              className="hidden h-10 items-center rounded-lg px-4 text-[0.9375rem] font-medium text-white transition-colors hover:bg-white/10 sm:inline-flex"
            >
              {secondary.label}
            </Link>
          ) : null}
          <Link
            href={primary.href}
            className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-[0.9375rem] font-semibold text-primary-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.16)] transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
          >
            {primary.label}
          </Link>
          <MobileNav primary={primary} secondary={secondary} />
        </div>
      </Container>
    </header>
  );
}
