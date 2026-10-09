'use client';

import { CornerDownLeft, Loader2, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { useCurrentUser } from '@/features/auth/components/current-user';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';
import { searchNavigation } from '../navigation-provider';
import { getSearchProviders, subscribeSearchProviders, type SearchResult } from '../registry';

type ResultGroup = { id: string; label: string; items: SearchResult[] };

function useSearchProviders() {
  return React.useSyncExternalStore(
    subscribeSearchProviders,
    getSearchProviders,
    getSearchProviders,
  );
}

function useGroupedResults(query: string, open: boolean) {
  const user = useCurrentUser();
  const providers = useSearchProviders();
  const [remote, setRemote] = React.useState<ResultGroup[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    const eligible = providers.filter(
      (provider) => trimmed.length >= (provider.minQueryLength ?? 2),
    );
    if (eligible.length === 0) {
      setRemote([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    Promise.allSettled(
      eligible.map(async (provider) => ({
        provider,
        items: await provider.search(trimmed, { user, signal: controller.signal }),
      })),
    ).then((settled) => {
      if (controller.signal.aborted) return;
      const groups: ResultGroup[] = [];
      for (const outcome of settled) {
        if (outcome.status === 'fulfilled' && outcome.value.items.length > 0) {
          groups.push({
            id: outcome.value.provider.id,
            label: outcome.value.provider.group,
            items: outcome.value.items,
          });
        }
      }
      setRemote(groups);
      setLoading(false);
    });
    return () => controller.abort();
  }, [query, open, providers, user]);

  const navigation = React.useMemo(() => searchNavigation(user, query), [user, query]);
  const groups: ResultGroup[] = [
    ...remote,
    ...(navigation.length > 0 ? [{ id: 'navigation', label: 'Pages', items: navigation }] : []),
  ];
  return { groups, loading };
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const debounced = useDebouncedValue(query, 200);
  const { groups, loading } = useGroupedResults(debounced, open);
  const flat = groups.flatMap((group) => group.items);

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  React.useEffect(() => setActive(0), [debounced]);

  function go(result: SearchResult | undefined): void {
    if (!result) return;
    onOpenChange(false);
    router.push(result.href);
  }

  function onKeyDown(event: React.KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(flat.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(flat[active]);
    }
  }

  let runningIndex = -1;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" hideClose className="top-[12vh] gap-0" onKeyDown={onKeyDown}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">
          Search pages and records. Use arrow keys to move and Enter to open.
        </DialogDescription>
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="size-4 text-primary" aria-hidden />
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls="palette-results"
            aria-activedescendant={flat[active] ? `palette-${flat[active].id}` : undefined}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages and records"
            className="h-12 flex-1 bg-transparent text-lg outline-none placeholder:text-subtle-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            aria-label="Search"
          />
          {loading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Searching" />
          ) : null}
        </div>
        <div
          id="palette-results"
          role="listbox"
          aria-label="Results"
          className="scroll-thin max-h-[50vh] overflow-y-auto p-1.5"
        >
          {flat.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <p className="text-sm font-medium">
                {query.trim() ? 'Nothing matches that search' : 'Jump anywhere in ProBuild'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {query.trim()
                  ? 'Try a document number, project code, item SKU or page name.'
                  : 'Type a page name, document number, project code or item SKU.'}
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.id} role="group" aria-label={group.label} className="mb-1">
                <p className="eyebrow px-2 pb-1 pt-2">{group.label}</p>
                {group.items.map((result) => {
                  runningIndex += 1;
                  const index = runningIndex;
                  const Icon = result.icon;
                  return (
                    <div
                      key={result.id}
                      id={`palette-${result.id}`}
                      role="option"
                      aria-selected={index === active}
                      onMouseMove={() => setActive(index)}
                      onClick={() => go(result)}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm',
                        index === active && 'bg-primary-subtle text-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-md border',
                          index === active
                            ? 'border-primary-border bg-surface text-primary'
                            : 'border-border bg-surface-muted text-muted-foreground',
                        )}
                        aria-hidden
                      >
                        {Icon ? <Icon className="size-3.5" strokeWidth={1.75} /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{result.title}</span>
                      {result.subtitle ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                      ) : null}
                      {index === active ? (
                        <CornerDownLeft className="size-3.5 text-primary" aria-hidden />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-border bg-surface-muted px-4 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> move
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Enter</Kbd> open
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Esc</Kbd> close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
