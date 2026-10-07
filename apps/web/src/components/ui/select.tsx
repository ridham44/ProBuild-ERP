import { ChevronDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { controlClasses } from './input';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/** Native select: fully accessible, keyboard friendly and mobile native. Styled to match inputs. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(controlClasses, 'h-9 cursor-pointer appearance-none pr-8 md:h-8', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
});
