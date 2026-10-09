import * as React from 'react';
import { cn } from '@/lib/utils';

export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface px-1 font-mono text-2xs text-muted-foreground shadow-[0_1px_0_hsl(var(--border-strong))]',
        className,
      )}
      {...props}
    />
  );
}
