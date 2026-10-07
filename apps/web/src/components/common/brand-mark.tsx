import { cn } from '@/lib/utils';

/** Two stacked slabs and a corner post: a plain structural mark, not a clip-art hard hat. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-6', className)} role="img" aria-label="ProBuild">
      <rect x="2" y="2" width="20" height="20" rx="3" className="fill-primary" />
      <path
        d="M7 17V7h5.2a3 3 0 0 1 0 6H7"
        fill="none"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}
