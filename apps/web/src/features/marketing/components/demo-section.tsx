import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SECTION } from '../content';
import { DEMO_ACCOUNT, DEMO_STEPS } from '../demo';
import { CopyField } from './copy-field';
import { Container, SectionHeading, cta } from './marketing-ui';

/** "Request a Demo" lands here: a self-serve demo account on sample data, ready to use without sign-up. */
export function DemoSection({ signedIn }: { signedIn: boolean }) {
  return (
    <section id={SECTION.demo} aria-labelledby="demo-title" className="scroll-mt-16 bg-background py-20 sm:py-28">
      <Container className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-20">
        <div>
          <SectionHeading
            id="demo-title"
            align="left"
            eyebrow="Live demo"
            title="Walk the whole procure-to-cost flow yourself"
            body="Use the shared demo administrator account to try ProBuild on sample data. No sign-up or sales call needed."
          />
          <ol className="mt-10 space-y-4">
            {DEMO_STEPS.map((step, index) => (
              <li key={step} className="flex items-start gap-4 text-base text-foreground sm:text-lg">
                <span className="num grid size-8 shrink-0 place-items-center rounded-full bg-primary-subtle text-sm font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="pt-1 sm:pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative isolate overflow-hidden rounded-2xl bg-sidebar p-6 text-sidebar-foreground shadow-pop sm:p-8">
          <div
            className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_100%_0%,hsl(var(--primary)/0.4),transparent)]"
            aria-hidden
          />
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-white">Demo credentials</h3>
            <span className="rounded-full bg-sidebar-accent/15 px-2.5 py-1 text-xs font-medium text-sidebar-accent">
              Administrator
            </span>
          </div>
          <div className="mt-6 space-y-5">
            <CopyField label="ID" value={DEMO_ACCOUNT.email} />
            <CopyField label="Password" value={DEMO_ACCOUNT.password} />
          </div>
          <Link
            href={signedIn ? '/' : '/login'}
            className={cn(cta.primary, 'mt-7 w-full focus-visible:ring-offset-sidebar')}
          >
            {signedIn ? 'Open dashboard' : 'Continue to sign in'}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-sidebar-muted">
            Shared demo account on a demo database. Do not enter real company data. It may be reset at any time.
          </p>
        </div>
      </Container>
    </section>
  );
}
