import { cn } from '@/lib/utils';

/**
 * Building blocks shared by the home page sections. The marketing page uses the app's tokens but a larger type
 * scale and roomier spacing than the dense ERP screens.
 */

const ctaBase =
  'inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-6 text-lg font-semibold outline-none transition-[background-color,border-color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-px';

export const cta = {
  /** Cobalt, the one primary action per view. */
  primary: cn(
    ctaBase,
    'bg-primary text-primary-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.16),0_10px_24px_-10px_hsl(var(--primary)/0.7)] hover:bg-primary-hover focus-visible:ring-ring',
  ),
  /** Outline on the navy hero and CTA panels. */
  onDark: cn(
    ctaBase,
    'border border-white/20 font-medium text-white hover:border-white/35 hover:bg-white/[0.08] focus-visible:ring-white',
  ),
  /** Outline on light sections. */
  onLight: cn(
    ctaBase,
    'border border-border-strong bg-surface font-medium text-foreground hover:bg-surface-muted focus-visible:ring-ring',
  ),
};

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}>{children}</div>;
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  body,
  align = 'center',
}: {
  id?: string;
  eyebrow: string;
  title: string;
  body: string;
  align?: 'center' | 'left';
}) {
  return (
    <div className={cn('max-w-3xl', align === 'center' && 'mx-auto text-center')}>
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent-strong">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-balance text-[2rem] font-semibold leading-tight tracking-tight sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">{body}</p>
    </div>
  );
}
