'use client';

import { LayoutGrid, List } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export type ListView = 'table' | 'cards';

/** Reads `?view=` so a refresh or shared link keeps the chosen layout. Table is the default. */
export function useListView(): [ListView, (next: ListView) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view: ListView = params.get('view') === 'cards' ? 'cards' : 'table';
  function setView(next: ListView): void {
    const query = new URLSearchParams(params.toString());
    if (next === 'table') query.delete('view');
    else query.set('view', next);
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }
  return [view, setView];
}

const OPTIONS: Array<{ value: ListView; label: string; icon: typeof List }> = [
  { value: 'table', label: 'Table', icon: List },
  { value: 'cards', label: 'Cards', icon: LayoutGrid },
];

/** Segmented table/cards switch. */
export function ViewToggle({ view, onChange }: { view: ListView; onChange: (next: ListView) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Layout"
      className="inline-flex h-8 items-center rounded-lg border border-border bg-surface-muted p-0.5"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = view === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              selected
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">{option.label}</span>
            <span className="sr-only sm:hidden">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
