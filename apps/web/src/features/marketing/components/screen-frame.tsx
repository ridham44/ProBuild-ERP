import Image from 'next/image';
import { cn } from '@/lib/utils';

/** Captured at 1280x800 CSS pixels and a 1.25 device scale (scripts/capture-marketing-screenshots.mjs). */
const SHOT_WIDTH = 1600;
const SHOT_HEIGHT = 1000;

/** A real product screenshot in a light browser frame. */
export function ScreenFrame({
  src,
  alt,
  label,
  className,
}: {
  src: string;
  alt: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-surface shadow-pop', className)}>
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-muted px-4 py-2.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="ml-3 truncate text-xs text-subtle-foreground">{label}</span>
      </div>
      <Image
        src={src}
        alt={alt}
        width={SHOT_WIDTH}
        height={SHOT_HEIGHT}
        sizes="(min-width: 1280px) 760px, (min-width: 1024px) 60vw, 100vw"
        className="h-auto w-full bg-surface-sunken"
      />
    </div>
  );
}
