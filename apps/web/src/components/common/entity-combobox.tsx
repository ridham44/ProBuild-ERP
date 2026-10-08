'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { Combobox, type ComboOption, type ComboboxProps } from '@/components/common/combobox';
import { errorMessage } from '@/lib/api/errors';
import { useDebouncedValue } from '@/lib/use-debounced-value';

export type EntityComboboxProps = Omit<
  ComboboxProps,
  'options' | 'onSearchChange' | 'loading'
> & {
  /** Stable identifier of the entity kind, e.g. "suppliers". Part of the query key. */
  entity: string;
  /** Fetches matches for the typed text; an empty string returns the first page of records. */
  search: (query: string) => Promise<ComboOption[]>;
  /** Options kept even when they are not in the latest result, e.g. the saved selection. */
  pinned?: ComboOption[];
};

/** Combobox backed by a server search, with the typed text debounced and results cached. */
export function EntityCombobox({ entity, search, pinned, ...props }: EntityComboboxProps) {
  const [text, setText] = React.useState('');
  const debounced = useDebouncedValue(text.trim(), 250);
  const results = useQuery({
    queryKey: ['entity-options', entity, debounced],
    queryFn: () => search(debounced),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const options = React.useMemo(() => {
    const found = results.data ?? [];
    const extra = (pinned ?? []).filter((p) => !found.some((option) => option.value === p.value));
    return [...found, ...extra];
  }, [results.data, pinned]);
  return (
    <Combobox
      {...props}
      options={options}
      onSearchChange={setText}
      loading={results.isFetching}
      {...(results.isError ? { emptyText: errorMessage(results.error) } : {})}
    />
  );
}
