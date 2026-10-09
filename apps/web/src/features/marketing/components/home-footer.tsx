import Link from 'next/link';
import { FOOTER_MODULE_LINKS, NAV_LINKS, SECTION } from '../content';
import { HomeLogo } from './home-nav';
import { Container } from './marketing-ui';

const linkClass = 'text-[0.9375rem] text-muted-foreground transition-colors hover:text-foreground';

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <ul className="mt-4 space-y-3">{children}</ul>
    </div>
  );
}

export function HomeFooter({ signedIn }: { signedIn: boolean }) {
  return (
    <footer className="border-t border-border bg-surface">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
        <div className="max-w-sm">
          <HomeLogo tone="light" />
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted-foreground">
            Construction ERP for project cost, procurement, inventory and approvals, set up for PHP and Philippine
            time.
          </p>
        </div>
        <Column title="Product">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className={linkClass}>
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a href={`#${SECTION.demo}`} className={linkClass}>
              Live demo
            </a>
          </li>
        </Column>
        <Column title="Modules">
          {FOOTER_MODULE_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={linkClass}>
                {link.label}
              </Link>
            </li>
          ))}
        </Column>
        <Column title="Account">
          <li>
            <Link href={signedIn ? '/' : '/login'} className={linkClass}>
              {signedIn ? 'Open dashboard' : 'Sign in'}
            </Link>
          </li>
          <li>
            <Link href="/reset-password" className={linkClass}>
              Reset password
            </Link>
          </li>
          <li>
            <a href={`#${SECTION.demo}`} className={linkClass}>
              Request a Demo
            </a>
          </li>
        </Column>
      </Container>
      <div className="border-t border-border">
        <Container className="flex flex-col gap-2 py-6 text-sm text-subtle-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>ProBuild ERP · Plan · Manage · Build · Grow</p>
          <p>Asia/Manila · PHP</p>
        </Container>
      </div>
    </footer>
  );
}
