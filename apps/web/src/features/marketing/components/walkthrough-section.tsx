'use client';

// The shared Tabs in components/ui are styled as an underlined row; the tour needs stacked cards, so it uses the
// same Radix primitive directly.
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { SECTION, WALKTHROUGH } from '../content';
import { Container } from './marketing-ui';
import { ScreenFrame } from './screen-frame';

export function WalkthroughSection() {
  return (
    <section
      id={SECTION.product}
      aria-labelledby="product-title"
      className="relative isolate scroll-mt-16 overflow-hidden bg-sidebar py-20 text-sidebar-foreground sm:py-28"
    >
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(40%_50%_at_90%_10%,hsl(var(--primary)/0.22),transparent)]"
        aria-hidden
      />
      <Container>
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-sidebar-accent">Product tour</p>
          <h2 id="product-title" className="mt-3 text-balance text-[2rem] font-semibold leading-tight tracking-tight text-white sm:text-4xl">
            See the work, screen by screen
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed sm:text-xl">
            Real screens from the ProBuild demo environment, following one project from request to cost.
          </p>
        </div>

        <TabsPrimitive.Root
          defaultValue={WALKTHROUGH[0].id}
          orientation="vertical"
          className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-10"
        >
          <TabsPrimitive.List aria-label="Product tour" className="flex flex-col gap-2">
            {WALKTHROUGH.map((panel, index) => (
              <TabsPrimitive.Trigger
                key={panel.id}
                value={panel.id}
                className="group rounded-xl border border-transparent px-4 py-3.5 text-left outline-none transition-colors hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-sidebar-accent data-[state=active]:border-white/10 data-[state=active]:bg-white/[0.07]"
              >
                <span className="flex items-center gap-3">
                  <span className="num grid size-7 shrink-0 place-items-center rounded-full border border-white/15 text-xs font-semibold text-sidebar-muted transition-colors group-data-[state=active]:border-sidebar-accent group-data-[state=active]:bg-sidebar-accent group-data-[state=active]:text-sidebar">
                    {index + 1}
                  </span>
                  <span className="text-lg font-semibold text-sidebar-foreground group-data-[state=active]:text-white">
                    {panel.title}
                  </span>
                </span>
                <span className="mt-2 hidden pl-10 text-[0.9375rem] leading-relaxed text-sidebar-foreground group-data-[state=active]:block">
                  {panel.body}
                </span>
              </TabsPrimitive.Trigger>
            ))}
          </TabsPrimitive.List>

          {WALKTHROUGH.map((panel) => (
            <TabsPrimitive.Content
              key={panel.id}
              value={panel.id}
              className="outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent motion-safe:data-[state=active]:animate-in motion-safe:data-[state=active]:fade-in-0 motion-safe:data-[state=active]:duration-300"
            >
              <ScreenFrame src={panel.image} alt={panel.alt} label={panel.title} className="border-white/10 shadow-[0_40px_80px_-24px_rgb(0_0_0/0.6)]" />
            </TabsPrimitive.Content>
          ))}
        </TabsPrimitive.Root>
      </Container>
    </section>
  );
}
