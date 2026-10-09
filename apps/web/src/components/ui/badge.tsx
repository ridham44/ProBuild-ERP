import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex h-[1.375rem] items-center gap-1 whitespace-nowrap rounded-full border px-2 text-xs font-medium leading-none [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-surface-muted text-muted-foreground',
        accent: 'border-accent-border bg-accent-subtle text-accent-strong',
        violet: 'border-violet-border bg-violet-subtle text-violet',
        primary: 'border-primary-border bg-primary-subtle text-primary',
        success: 'border-success-border bg-success-subtle text-success',
        warning: 'border-warning-border bg-warning-subtle text-warning',
        danger: 'border-danger-border bg-danger-subtle text-danger',
        info: 'border-info-border bg-info-subtle text-info',
        pending: 'border-pending-border bg-pending-subtle text-pending',
        approved: 'border-approved-border bg-approved-subtle text-approved',
        rejected: 'border-rejected-border bg-rejected-subtle text-rejected',
        overdue: 'border-overdue-border bg-overdue-subtle text-overdue',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
