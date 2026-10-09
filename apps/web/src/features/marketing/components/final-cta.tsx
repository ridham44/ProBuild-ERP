import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Container, cta } from './marketing-ui';

type Cta = { href: string; label: string };

export function FinalCta({ primary, secondary }: { primary: Cta; secondary: Cta }) {
  return (
    <section aria-labelledby="final-cta-title" className="bg-background pb-20 sm:pb-28">
      <Container>
        <div className="relative isolate overflow-hidden rounded-3xl bg-sidebar px-6 py-14 text-center text-sidebar-foreground shadow-pop sm:px-12 sm:py-20">
          <div
            className="absolute inset-0 -z-10 bg-[radial-gradient(50%_70%_at_50%_0%,hsl(var(--primary)/0.4),transparent),radial-gradient(30%_50%_at_100%_100%,hsl(var(--sidebar-accent)/0.12),transparent)]"
            aria-hidden
          />
          <h2
            id="final-cta-title"
            className="mx-auto max-w-3xl text-balance text-[2rem] font-semibold leading-tight tracking-tight text-white sm:text-[2.75rem]"
          >
            Connect every material purchase to the project it serves.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed sm:text-xl">
            See how ProBuild fits your procurement, warehouse and project-cost workflows. Walk the full chain in the
            live demo, on sample data, in a few minutes.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={primary.href} className={cn(cta.primary, 'focus-visible:ring-offset-sidebar')}>
              {primary.label}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href={secondary.href} className={cn(cta.onDark, 'focus-visible:ring-offset-sidebar')}>
              {secondary.label}
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
