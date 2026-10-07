'use client';

import { FilterX } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type FilterBarProps = {
  children: React.ReactNode;
  /** Number of filters currently narrowing the list. */
  activeCount?: number;
  onReset?: () => void;
  trailing?: React.ReactNode;
  className?: string;
};

/** Row above a list that holds search, filters and view controls. */
export function FilterBar({
  children,
  activeCount = 0,
  onReset,
  trailing,
  className,
}: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} role="search">
      {children}
      {activeCount > 0 && onReset ? (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <FilterX className="size-3.5" aria-hidden />
          Clear {activeCount > 1 ? `${activeCount} filters` : 'filter'}
        </Button>
      ) : null}
      {trailing ? <div className="ml-auto flex items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
