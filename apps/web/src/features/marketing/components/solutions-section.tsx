import { BENEFITS, SECTION, SOLUTIONS_IMAGE } from '../content';
import { Container, SectionHeading } from './marketing-ui';
import { ScreenFrame } from './screen-frame';

export function SolutionsSection() {
  return (
    <section id={SECTION.solutions} aria-labelledby="solutions-title" className="scroll-mt-16 bg-background py-20 sm:py-28">
      <Container className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-16">
        <div>
          <SectionHeading
            id="solutions-title"
            align="left"
            eyebrow="Why it matters"
            title="When purchasing, stock and project costs share one record"
            body="Material is a major share of cost on most construction projects. Disconnected purchase, warehouse and cost records make it hard to see where it went."
          />
          <ul className="mt-10 space-y-7">
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-surface text-primary shadow-card">
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <div>
                  <h3 className="text-lg font-semibold leading-snug text-foreground">{title}</h3>
                  <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted-foreground sm:text-base sm:leading-relaxed">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <figure className="lg:sticky lg:top-24 lg:self-start">
          <ScreenFrame src={SOLUTIONS_IMAGE.src} alt={SOLUTIONS_IMAGE.alt} label="Projects / Metro Heights Tower A / Financial" />
          <figcaption className="mt-4 text-[0.9375rem] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Project financials.</span> Budget, committed and actual cost
            for each cost code, updated as orders are approved and material is issued. Real screen from the demo
            environment.
          </figcaption>
        </figure>
      </Container>
    </section>
  );
}
