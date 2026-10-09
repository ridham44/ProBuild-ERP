import { ArrowRight, Building2, CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Container, cta } from './marketing-ui';
import { ProductPreview } from './product-preview';

type Cta = { href: string; label: string };

const ENTER = 'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:duration-700';

export function HomeHero({ primary, secondary }: { primary: Cta; secondary: Cta }) {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-sidebar text-sidebar-foreground">
      <div
        className="absolute inset-0 -z-10 [background-image:linear-gradient(hsl(0_0%_100%/0.035)_1px,transparent_1px),linear-gradient(90deg,hsl(0_0%_100%/0.035)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_80%_70%_at_30%_0%,black,transparent)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(45%_55%_at_80%_35%,hsl(var(--primary)/0.28),transparent),radial-gradient(35%_40%_at_0%_100%,hsl(var(--sidebar-accent)/0.10),transparent)]"
        aria-hidden
      />
      <Container className="grid items-center gap-14 pb-16 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] lg:gap-12 lg:pb-24 lg:pt-20 xl:gap-20">
        <div className={ENTER}>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-sm font-medium text-white/90">
            <Building2 className="size-4 text-sidebar-accent" aria-hidden />
            Construction ERP for Philippine contractors
          </p>
          <h1
            id="hero-title"
            className="mt-6 text-balance text-[2.5rem] font-semibold leading-[1.06] tracking-[-0.025em] text-white sm:text-5xl lg:text-[3.25rem] xl:text-[3.625rem]"
          >
            One ledger from the first purchase request to the <span className="text-sidebar-accent">project cost.</span>
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-sidebar-foreground sm:text-xl sm:leading-relaxed">
            Purchasing, the warehouse and the project team often work from separate spreadsheets. ProBuild connects
            procurement, inventory and project costs, so every peso of material is approved, traceable and charged to
            the right project and cost code.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={primary.href} className={cn(cta.primary, 'focus-visible:ring-offset-sidebar')}>
              {primary.label}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href={secondary.href} className={cn(cta.onDark, 'focus-visible:ring-offset-sidebar')}>
              {secondary.label}
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem] text-sidebar-foreground">
            {['Self-serve live demo', 'No sign-up needed', 'PHP and Manila time'].map((item) => (
              <li key={item} className="inline-flex items-center gap-2">
                <CircleCheck className="size-4 text-sidebar-accent" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <ProductPreview
          className={cn(ENTER, 'mx-auto w-full max-w-2xl motion-safe:fill-mode-both motion-safe:delay-150 lg:max-w-none')}
        />
      </Container>
    </section>
  );
}
