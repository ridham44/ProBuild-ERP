'use client';

import * as React from 'react';
import { useCursorPagination } from '@/components/common/pagination';
import { useDebouncedValue } from '@/lib/use-debounced-value';

type FilterValues = Record<string, string | undefined>;

/**
 * Search box, filters and cursor paging for a server-side list. Changing the search or any filter returns
 * to the first page. Filter values are plain strings; an empty string means "not filtering".
 */
export function useListState<F extends FilterValues>(initialFilters: F, pageSize = 25) {
  const initial = React.useRef(initialFilters).current;
  const [search, setSearch] = React.useState('');
  const [filters, setFilters] = React.useState<F>(initial);
  const debounced = useDebouncedValue(search.trim(), 300);
  const paging = useCursorPagination();
  const { reset } = paging;
  const filterKey = JSON.stringify(filters);
  React.useEffect(() => reset(), [debounced, filterKey, reset]);

  const setFilter = React.useCallback(<K extends keyof F>(key: K, value: F[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);
  const clearFilters = React.useCallback(() => {
    setFilters(initial);
    setSearch('');
  }, [initial]);

  const activeCount = Object.entries(filters).filter(
    ([key, value]) => (value ?? '') !== (initial[key] ?? ''),
  ).length;

  const query: Record<string, string | number> = {
    limit: pageSize,
    ...(debounced ? { search: debounced } : {}),
    ...(paging.cursor ? { cursor: paging.cursor } : {}),
    ...Object.fromEntries(
      Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ),
  };

  return { search, setSearch, debounced, filters, setFilter, clearFilters, activeCount, paging, query };
}
