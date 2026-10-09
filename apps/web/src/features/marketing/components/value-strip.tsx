import { VALUE_POINTS } from '../content';
import { Container } from './marketing-ui';

export function ValueStrip() {
  return (
    <section aria-label="What ProBuild connects" className="border-b border-border bg-surface">
      <Container>
        {/* A 1px gap over a border-coloured background draws the separators at every breakpoint. */}
        <ul className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {VALUE_POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-4 bg-surface py-6 sm:px-6 sm:py-8">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-subtle text-accent-strong">
                <Icon className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <div>
                <p className="text-lg font-semibold leading-snug text-foreground">{title}</p>
                <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
