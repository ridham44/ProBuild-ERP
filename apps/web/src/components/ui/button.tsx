import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium outline-none transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.14),0_1px_2px_hsl(var(--shadow)/0.16)] hover:bg-primary-hover',
        secondary:
          'border border-border bg-surface text-foreground shadow-xs hover:border-border-strong hover:bg-surface-muted',
        ghost: 'text-muted-foreground hover:bg-surface-sunken/70 hover:text-foreground',
        subtle: 'bg-primary-subtle text-primary hover:bg-primary-subtle/70',
        danger:
          'bg-danger text-white shadow-[inset_0_1px_0_hsl(0_0%_100%/0.12),0_1px_2px_hsl(var(--shadow)/0.16)] hover:bg-danger/90',
        link: 'h-auto px-0 text-primary underline-offset-2 hover:underline',
      },
      size: {
        sm: 'h-7 px-2.5 text-sm',
        md: 'h-9 px-3 text-base md:h-8 md:text-sm',
        lg: 'h-10 px-4 text-base',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    asChild = false,
    loading = false,
    disabled,
    children,
    type,
    ...props
  },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if (asChild) {
    return (
      <Slot className={classes} ref={ref} {...props}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'asChild'> {
  label: string;
  children: React.ReactNode;
}

/** Square icon-only button. `label` is mandatory because there is no visible text. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, className, size, variant = 'ghost', children, ...props },
  ref,
) {
  const dimension = size === 'sm' ? 'size-7' : size === 'lg' ? 'size-10' : 'size-9 md:size-8';
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      aria-label={label}
      title={label}
      className={cn(dimension, 'p-0', className)}
      {...props}
    >
      {children}
    </Button>
  );
});
