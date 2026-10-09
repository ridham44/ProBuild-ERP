'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type PaginationProps = {
  /** Rows on the current page. */
  count: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  loading?: boolean;
  className?: string;
};

/** Cursor pagination has no total or page numbers, so the control only offers previous and next. */
export function Pagination({
  count,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  loading,
  className,
}: PaginationProps) {
  if (!hasPrevious && !hasNext) {
    return count === 0 ? null : (
      <p className={cn('num text-xs text-muted-foreground', className)}>
        {count} {count === 1 ? 'row' : 'rows'}
      </p>
    );
  }
  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'num flex items-center justify-between gap-3 text-xs text-muted-foreground',
        className,
      )}
    >
      <span aria-live="polite">
        {count === 0 ? 'No rows' : `${count} ${count === 1 ? 'row' : 'rows'} on this page`}
      </span>
      <div className="flex items-center gap-1.5">
        <Button size="sm" onClick={onPrevious} disabled={!hasPrevious || loading}>
          <ChevronLeft className="size-3.5" aria-hidden />
          Previous
        </Button>
        <Button size="sm" onClick={onNext} disabled={!hasNext || loading}>
          Next
          <ChevronRight className="size-3.5" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}

/** Tracks the cursor stack so "Previous" can return to earlier pages. Call `reset` when filters change. */
export function useCursorPagination() {
  const [stack, setStack] = useState<string[]>([]);
  const cursor = stack[stack.length - 1];
  const goNext = useCallback((nextCursor: string | null) => {
    if (nextCursor) setStack((current) => [...current, nextCursor]);
  }, []);
  const goPrevious = useCallback(() => setStack((current) => current.slice(0, -1)), []);
  const reset = useCallback(() => setStack([]), []);
  return { cursor, hasPrevious: stack.length > 0, goNext, goPrevious, reset };
}
