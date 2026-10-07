'use client';

import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import * as React from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { controlClasses } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type ComboOption = { value: string; label: string; description?: string };

export type ComboboxProps = {
  id?: string;
  options: ComboOption[];
  /** Selected option value, or null. */
  value: string | null;
  /** Label to show for the current value when it is not among `options` (e.g. before a search runs). */
  selectedLabel?: string;
  onChange: (value: string | null, option: ComboOption | null) => void;
  /** Called with the typed text; the caller fetches options (typically via TanStack Query). */
  onSearchChange?: (query: string) => void;
  loading?: boolean;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  clearable?: boolean;
  'aria-invalid'?: boolean | undefined;
  'aria-describedby'?: string | undefined;
  className?: string;
};

/** Searchable single select with async-friendly controlled options and full keyboard support. */
export function Combobox({
  id,
  options,
  value,
  selectedLabel,
  onChange,
  onSearchChange,
  loading = false,
  placeholder = 'Select',
  emptyText = 'No matches',
  disabled,
  clearable = true,
  className,
  ...aria
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const listId = React.useId();
  const selected = options.find((option) => option.value === value);
  const display = selected?.label ?? selectedLabel ?? '';

  const visible = onSearchChange
    ? options
    : options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));

  function updateQuery(next: string): void {
    setQuery(next);
    setActive(0);
    setOpen(true);
    onSearchChange?.(next);
  }

  function choose(option: ComboOption | null): void {
    onChange(option?.value ?? null, option);
    setQuery('');
    onSearchChange?.('');
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(visible.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter' && open) {
      const option = visible[active];
      if (option) {
        event.preventDefault();
        choose(option);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn('relative', className)}>
          <input
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && visible[active] ? `${listId}-${active}` : undefined}
            aria-invalid={aria['aria-invalid']}
            aria-describedby={aria['aria-describedby']}
            autoComplete="off"
            disabled={disabled}
            className={cn(controlClasses, 'h-9 pr-14 md:h-8')}
            placeholder={open || !display ? placeholder : display}
            value={open ? query : display}
            onChange={(event) => updateQuery(event.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
          <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1 text-muted-foreground">
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" aria-label="Loading options" />
            ) : null}
            {clearable && value && !disabled ? (
              <button
                type="button"
                onClick={() => choose(null)}
                className="rounded px-1 text-xs hover:text-foreground"
                aria-label="Clear selection"
              >
                Clear
              </button>
            ) : (
              <ChevronsUpDown className="size-3.5" aria-hidden />
            )}
          </div>
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-56 p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (event.target instanceof HTMLElement && event.target.id === id) event.preventDefault();
        }}
      >
        <ul id={listId} role="listbox" className="scroll-thin max-h-60 overflow-auto">
          {visible.length === 0 ? (
            <li className="px-2 py-2 text-sm text-muted-foreground">
              {loading ? 'Searching…' : emptyText}
            </li>
          ) : (
            visible.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                  index === active && 'bg-surface-muted',
                )}
              >
                <Check
                  className={cn(
                    'size-3.5 shrink-0',
                    option.value === value ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{option.label}</span>
                  {option.description ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
