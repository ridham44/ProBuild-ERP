import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

const alertVariants = cva('flex gap-2.5 rounded border px-3 py-2.5 text-sm', {
  variants: {
    tone: {
      info: 'border-info-border bg-info-subtle text-foreground [&_svg]:text-info',
      success: 'border-success-border bg-success-subtle text-foreground [&_svg]:text-success',
      warning: 'border-warning-border bg-warning-subtle text-foreground [&_svg]:text-warning',
      danger: 'border-danger-border bg-danger-subtle text-foreground [&_svg]:text-danger',
    },
  },
  defaultVariants: { tone: 'info' },
});

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: OctagonAlert,
} as const;

export interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof alertVariants> {
  title?: React.ReactNode;
  action?: React.ReactNode;
}

export function Alert({ className, tone = 'info', title, action, children, ...props }: AlertProps) {
  const Icon = icons[tone ?? 'info'];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? (
          <div className={cn('text-muted-foreground', title && 'mt-0.5')}>{children}</div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
