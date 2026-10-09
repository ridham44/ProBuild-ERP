import { cn } from '@/lib/utils';
import { SECTION, WORKFLOW_PHASES, WORKFLOW_STEPS, type WorkflowPhase } from '../content';
import { Container, SectionHeading } from './marketing-ui';

const PHASE_STYLE: Record<WorkflowPhase, { node: string; text: string; dot: string }> = {
  buy: { node: 'bg-primary text-primary-foreground', text: 'text-primary', dot: 'bg-primary' },
  receive: { node: 'bg-accent text-accent-foreground', text: 'text-accent-strong', dot: 'bg-accent' },
  use: { node: 'bg-violet text-white', text: 'text-violet', dot: 'bg-violet' },
  cost: { node: 'bg-success text-white', text: 'text-success', dot: 'bg-success' },
};

const LAST = WORKFLOW_STEPS.length - 1;

/**
 * Which connector a step draws to the next one. Mobile is a vertical timeline; desktop is two rows of four, then one
 * row of eight on wide screens, so the line is hidden at the end of each row.
 */
function connectorClasses(index: number) {
  if (index === LAST) return { vertical: 'hidden', horizontal: 'hidden' };
  const endOfRowOfFour = index % 4 === 3;
  return {
    vertical: 'lg:hidden',
    horizontal: endOfRowOfFour ? 'hidden xl:block' : 'hidden lg:block',
  };
}

export function WorkflowSection() {
  const phaseLabel = Object.fromEntries(WORKFLOW_PHASES.map((phase) => [phase.key, phase.label]));

  return (
    <section
      id={SECTION.workflow}
      aria-labelledby="workflow-title"
      className="scroll-mt-16 border-y border-border bg-surface py-20 sm:py-28"
    >
      <Container>
        <SectionHeading
          id="workflow-title"
          eyebrow="Procure to cost"
          title="From a site request to a cost on the project"
          body="Eight connected stages. Each one is approved where it needs to be, recorded in the audit history, and tied to the WBS, cost code and BOQ line it belongs to."
        />

        <ul className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2" aria-label="Stages are grouped into phases">
          {WORKFLOW_PHASES.map((phase) => (
            <li key={phase.key} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className={cn('size-2.5 rounded-full', PHASE_STYLE[phase.key].dot)} aria-hidden />
              {phase.label}
            </li>
          ))}
        </ul>

        <ol className="mx-auto mt-12 grid max-w-xl gap-0 lg:max-w-none lg:grid-cols-4 lg:gap-x-6 lg:gap-y-12 xl:grid-cols-8 xl:gap-x-4">
          {WORKFLOW_STEPS.map((step, index) => {
            const style = PHASE_STYLE[step.phase];
            const connector = connectorClasses(index);
            return (
              <li key={step.label} className="relative flex gap-5 pb-9 last:pb-0 lg:flex-col lg:gap-4 lg:pb-0">
                <span
                  className={cn('absolute bottom-0 left-[1.375rem] top-12 w-px bg-border-strong', connector.vertical)}
                  aria-hidden
                />
                <span
                  className={cn(
                    'absolute left-14 right-0 top-[1.375rem] h-px bg-border-strong xl:left-[3.25rem] xl:-right-2',
                    connector.horizontal,
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    'num relative grid size-11 shrink-0 place-items-center rounded-full text-[0.9375rem] font-semibold shadow-sm ring-4 ring-surface',
                    style.node,
                  )}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="pt-1.5 lg:pt-0">
                  <p className={cn('text-xs font-semibold uppercase tracking-[0.1em]', style.text)}>
                    {phaseLabel[step.phase]}
                  </p>
                  <p className="mt-1 text-lg font-semibold leading-snug text-foreground">{step.label}</p>
                  <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted-foreground">{step.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <p className="mx-auto mt-14 max-w-3xl rounded-xl border border-border bg-surface-muted px-5 py-4 text-center text-[0.9375rem] leading-relaxed text-muted-foreground">
          Every stage above has working screens today. Stock transfers, adjustments and counts are already recorded in
          the stock ledger; their own entry screens are in progress.
        </p>
      </Container>
    </section>
  );
}
