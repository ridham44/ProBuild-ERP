import { ArrowRight, Check, Clock } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { MODULES, ROADMAP, SECTION, type ModuleCard } from '../content';
import { Container, SectionHeading } from './marketing-ui';

function StatusTag({ status }: { status: ModuleCard['status'] }) {
  return status === 'live' ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-success-border bg-success-subtle px-2.5 py-0.5 text-xs font-medium text-success">
      <Check className="size-3" aria-hidden />
      Available
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-warning-border bg-warning-subtle px-2.5 py-0.5 text-xs font-medium text-warning">
      <Clock className="size-3" aria-hidden />
      Partly available
    </span>
  );
}

function Module({ module, featured = false }: { module: ModuleCard; featured?: boolean }) {
  const Icon = module.icon;
  return (
    <li
      className={cn(
        'group relative flex flex-col rounded-2xl border bg-surface p-6 shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:border-primary-border hover:shadow-lift motion-safe:hover:-translate-y-0.5 sm:p-7',
        module.status === 'partial' ? 'border-dashed border-border-strong' : 'border-border',
        featured &&
          'bg-[linear-gradient(160deg,hsl(var(--primary-subtle))_0%,hsl(var(--surface))_55%)] sm:col-span-2 lg:col-span-2',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'grid size-12 place-items-center rounded-xl',
            featured ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-primary-subtle text-primary',
          )}
        >
          <Icon className="size-6" strokeWidth={1.75} aria-hidden />
        </span>
        <StatusTag status={module.status} />
      </div>
      <div className={cn('mt-6 flex-1', featured && 'grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]')}>
        <div>
          <h3 className={cn('font-semibold tracking-tight text-foreground', featured ? 'text-2xl' : 'text-xl')}>
            {module.title}
          </h3>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground sm:text-base sm:leading-relaxed">
            {module.body}
          </p>
          {module.note ? (
            <p className="mt-3 rounded-lg bg-surface-sunken px-3 py-2 text-sm leading-relaxed text-muted-foreground">
              {module.note}
            </p>
          ) : null}
        </div>
        {module.points ? (
          <ul className="space-y-2.5 self-center">
            {module.points.map((point) => (
              <li key={point} className="flex items-center gap-2.5 text-[0.9375rem] font-medium text-foreground">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-subtle text-accent-strong">
                  <Check className="size-3" aria-hidden />
                </span>
                {point}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Link
        href={module.href}
        className="mt-6 inline-flex items-center gap-1.5 self-start rounded text-[0.9375rem] font-semibold text-primary after:absolute after:inset-0 after:rounded-2xl after:content-[''] hover:text-primary-hover"
      >
        View in the demo
        <span className="sr-only">: {module.title}</span>
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </li>
  );
}

export function ModulesSection() {
  const [featured, ...rest] = MODULES;
  return (
    <section id={SECTION.modules} aria-labelledby="modules-title" className="scroll-mt-16 bg-background py-20 sm:py-28">
      <Container>
        <SectionHeading
          id="modules-title"
          eyebrow="Modules"
          title="Everything a project needs to buy, receive and account for material"
          body="Each module posts to the same ledgers, so what the site team records is what the finance team sees."
        />
        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured ? <Module module={featured} featured /> : null}
          {rest.map((module) => (
            <Module key={module.title} module={module} />
          ))}
          <li className="flex flex-col justify-center rounded-2xl border border-border bg-surface-sunken p-6 sm:p-7 lg:col-span-2">
            <p className="eyebrow">On the roadmap</p>
            <p className="mt-2 text-lg font-semibold text-foreground">Planned, not yet available</p>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Planned modules">
              {ROADMAP.map((name) => (
                <li
                  key={name}
                  className="rounded-full border border-dashed border-border-strong bg-surface px-3 py-1 text-sm text-muted-foreground"
                >
                  {name}
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </Container>
    </section>
  );
}
