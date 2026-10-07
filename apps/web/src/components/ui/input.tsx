import * as React from 'react';
import { cn } from '@/lib/utils';

export const controlClasses =
  'w-full rounded border border-input bg-surface px-2.5 text-base text-foreground shadow-xs placeholder:text-subtle-foreground transition-colors hover:border-border-strong focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted-foreground aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger md:text-sm';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(controlClasses, 'h-9 md:h-8', className)}
      {...props}
    />
  );
});

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 3, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(controlClasses, 'min-h-16 py-1.5', className)}
      {...props}
    />
  );
});
