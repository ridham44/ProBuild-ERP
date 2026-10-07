import * as React from 'react';
import { cn } from '@/lib/utils';

export type FormSectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

/** Two-column section: purpose on the left, fields on the right. Stacks on narrow screens. */
export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section
      className={cn(
        'grid gap-3 border-b border-border py-5 first:pt-0 last:border-b-0 md:grid-cols-[14rem_1fr] md:gap-8',
        className,
      )}
    >
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
