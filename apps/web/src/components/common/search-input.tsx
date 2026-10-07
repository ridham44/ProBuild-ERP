'use client';

import { Search, X } from 'lucide-react';
import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type SearchInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> & {
  value: string;
  onValueChange: (value: string) => void;
  wrapperClassName?: string;
};

export function SearchInput({
  value,
  onValueChange,
  className,
  wrapperClassName,
  placeholder = 'Search',
  'aria-label': ariaLabel,
  ...props
}: SearchInputProps) {
  return (
    <div className={cn('relative w-full sm:w-64', wrapperClassName)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={cn('pl-8 pr-7 [&::-webkit-search-cancel-button]:hidden', className)}
        {...props}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onValueChange('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
