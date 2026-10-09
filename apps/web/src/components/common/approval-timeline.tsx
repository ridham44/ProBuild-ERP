import { Check, Clock, Minus, X } from 'lucide-react';
import * as React from 'react';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export type ApprovalStepState = 'approved' | 'rejected' | 'current' | 'waiting' | 'skipped';

export type ApprovalStepView = {
  order: number;
  /** Role responsible for this step. */
  roleName: string;
  state: ApprovalStepState;
  approver?: string;
  decidedAt?: string;
  comment?: string | null;
};

const stateStyles: Record<
  ApprovalStepState,
  { dot: string; label: string; icon: React.ReactNode }
> = {
  approved: {
    dot: 'border-approved bg-approved text-primary-foreground',
    label: 'Approved',
    icon: <Check className="size-3" strokeWidth={3} />,
  },
  rejected: {
    dot: 'border-rejected bg-rejected text-primary-foreground',
    label: 'Rejected',
    icon: <X className="size-3" strokeWidth={3} />,
  },
  current: {
    dot: 'border-pending bg-pending-subtle text-pending',
    label: 'Awaiting decision',
    icon: <Clock className="size-3" />,
  },
  waiting: {
    dot: 'border-border-strong bg-surface text-subtle-foreground',
    label: 'Waiting',
    icon: null,
  },
  skipped: {
    dot: 'border-border bg-surface-muted text-subtle-foreground',
    label: 'Not reached',
    icon: <Minus className="size-3" />,
  },
};

const labelTone: Record<ApprovalStepState, string> = {
  approved: 'text-approved',
  rejected: 'text-rejected',
  current: 'text-pending',
  waiting: 'text-subtle-foreground',
  skipped: 'text-subtle-foreground',
};

/** Ordered approver steps with decision, approver, timestamp and comment. */
export function ApprovalTimeline({
  steps,
  className,
}: {
  steps: ApprovalStepView[];
  className?: string;
}) {
  return (
    <ol className={cn('space-y-0', className)} aria-label="Approval steps">
      {steps.map((step, index) => {
        const style = stateStyles[step.state];
        return (
          <li
            key={step.order}
            className="relative flex gap-3 pb-4 last:pb-0"
            aria-current={step.state === 'current' ? 'step' : undefined}
          >
            {index < steps.length - 1 ? (
              <span
                className="absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-px bg-border"
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-2xs font-semibold',
                style.dot,
              )}
            >
              {style.icon ?? step.order}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-medium">
                  Step {step.order}{' '}
                  <span className="font-normal text-muted-foreground">· {step.roleName}</span>
                </p>
                <p className={cn('text-xs font-medium', labelTone[step.state])}>{style.label}</p>
              </div>
              {step.approver || step.decidedAt ? (
                <p className="text-xs text-muted-foreground">
                  {step.approver ? <span>{step.approver}</span> : null}
                  {step.approver && step.decidedAt ? ' · ' : null}
                  {step.decidedAt ? (
                    <time dateTime={step.decidedAt}>{formatDateTime(step.decidedAt)}</time>
                  ) : null}
                </p>
              ) : null}
              {step.comment ? (
                <p className="mt-1.5 rounded-md border-l-2 border-border-strong bg-surface-muted px-3 py-1.5 text-sm text-muted-foreground">
                  {step.comment}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
