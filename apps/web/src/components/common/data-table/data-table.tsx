'use client';

import {
  flexRender,
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import * as React from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { Pagination, type PaginationProps } from '@/components/common/pagination';
import { SearchInput } from '@/components/common/search-input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { presentation, type ColumnPresentation, type DataColumn } from './column-meta';
import { ColumnVisibilityMenu } from './column-visibility-menu';
import { DensityToggle, type Density } from './density-toggle';
import { SortIndicator } from './sort-indicator';

const HIDE_BELOW: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

function SkeletonCell({ meta, padding }: { meta: ColumnPresentation; padding: string }) {
  return (
    <td
      className={cn(
        'border-b border-border/70',
        padding,
        meta.hideBelow && HIDE_BELOW[meta.hideBelow],
      )}
    >
      <Skeleton className={cn('h-3.5', meta.numeric ? 'ml-auto w-16' : 'w-3/4')} />
    </td>
  );
}

export type DataTableProps<T> = {
  columns: DataColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  /** Accessible name for the table. */
  caption: string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyState: React.ReactNode;
  /** Enables a search box that filters the rows already loaded, using this text per row. */
  getSearchText?: (row: T) => string;
  searchPlaceholder?: string;
  selectable?: boolean;
  onSelectionChange?: (rows: T[]) => void;
  onRowActivate?: (row: T) => void;
  /** Extra controls placed left of the built-in ones. */
  toolbar?: React.ReactNode;
  pagination?: PaginationProps;
  initialVisibility?: VisibilityState;
  className?: string;
  maxHeightClassName?: string;
};

export function DataTable<T>({
  columns,
  data,
  getRowId,
  caption,
  loading = false,
  error,
  onRetry,
  emptyState,
  getSearchText,
  searchPlaceholder = 'Filter rows',
  selectable = false,
  onSelectionChange,
  onRowActivate,
  toolbar,
  pagination,
  initialVisibility,
  className,
  maxHeightClassName = 'max-h-[calc(100vh-18rem)]',
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [visibility, setVisibility] = React.useState<VisibilityState>(initialVisibility ?? {});
  const [selection, setSelection] = React.useState<RowSelectionState>({});
  const [search, setSearch] = React.useState('');
  const [density, setDensity] = React.useState<Density>('compact');
  const [focusIndex, setFocusIndex] = React.useState(0);
  const bodyRef = React.useRef<HTMLTableSectionElement>(null);

  const table = useReactTable({
    data,
    columns: columns as ColumnDef<T>[],
    getRowId,
    state: { sorting, columnVisibility: visibility, rowSelection: selection, globalFilter: search },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    onRowSelectionChange: setSelection,
    onGlobalFilterChange: setSearch,
    globalFilterFn: (row, _columnId, value: string) =>
      getSearchText
        ? getSearchText(row.original).toLowerCase().includes(value.toLowerCase())
        : true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: selectable,
  });

  const rows = table.getRowModel().rows;
  const visibleColumns = table.getVisibleLeafColumns();
  const cellPadding =
    density === 'compact' ? 'px-3 py-2 first:pl-4 last:pr-4' : 'px-3 py-3.5 first:pl-4 last:pr-4';

  React.useEffect(() => {
    if (!onSelectionChange) return;
    onSelectionChange(table.getSelectedRowModel().rows.map((row) => row.original));
  }, [selection, onSelectionChange, table]);

  function moveFocus(nextIndex: number): void {
    const rowElements = bodyRef.current?.querySelectorAll<HTMLTableRowElement>('tr[data-row]');
    if (!rowElements || rowElements.length === 0) return;
    const clamped = Math.max(0, Math.min(rowElements.length - 1, nextIndex));
    setFocusIndex(clamped);
    rowElements[clamped]?.focus();
  }

  function handleRowKeyDown(
    event: React.KeyboardEvent<HTMLTableRowElement>,
    index: number,
    rowIndexData: T,
    toggle: () => void,
  ): void {
    if (event.target !== event.currentTarget) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        moveFocus(0);
        break;
      case 'End':
        event.preventDefault();
        moveFocus(rows.length - 1);
        break;
      case 'Enter':
        if (onRowActivate) {
          event.preventDefault();
          onRowActivate(rowIndexData);
        }
        break;
      case ' ':
        if (selectable) {
          event.preventDefault();
          toggle();
        }
        break;
      default:
        break;
    }
  }

  const selectedCount = Object.keys(selection).length;
  const filteredOut = !loading && !error && data.length > 0 && rows.length === 0;

  const showFooter =
    pagination !== undefined &&
    !error &&
    data.length > 0 &&
    (pagination.hasNext || pagination.hasPrevious || pagination.count > 0);

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5 md:px-4">
        {getSearchText ? (
          <SearchInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder} />
        ) : null}
        {toolbar}
        <div className="ml-auto flex items-center gap-1.5">
          {selectedCount > 0 ? (
            <span
              className="mr-1 rounded-full bg-primary-subtle px-2 py-0.5 text-xs font-medium text-primary"
              aria-live="polite"
            >
              {selectedCount} selected
            </span>
          ) : null}
          <ColumnVisibilityMenu table={table} />
          <DensityToggle density={density} onChange={setDensity} />
        </div>
      </div>

      <div>
        {error ? (
          <QueryErrorState error={error} {...(onRetry ? { onRetry } : {})} compact />
        ) : !loading && data.length === 0 ? (
          emptyState
        ) : (
          <div className={cn('scroll-thin overflow-auto', maxHeightClassName)}>
            <table
              className="w-full min-w-max border-separate border-spacing-0 text-sm"
              aria-label={caption}
              aria-busy={loading || undefined}
            >
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {selectable ? (
                      <th
                        scope="col"
                        className="sticky left-0 top-0 z-20 w-9 border-b border-border bg-surface-muted py-2.5 pl-4 pr-3"
                      >
                        <Checkbox
                          aria-label="Select all rows"
                          checked={
                            table.getIsAllRowsSelected()
                              ? true
                              : table.getIsSomeRowsSelected()
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={(checked) =>
                            table.toggleAllRowsSelected(checked === true)
                          }
                        />
                      </th>
                    ) : null}
                    {group.headers.map((header) => {
                      const meta = presentation(header.column.columnDef.meta);
                      const sorted = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={
                            sorted === 'asc'
                              ? 'ascending'
                              : sorted === 'desc'
                                ? 'descending'
                                : undefined
                          }
                          className={cn(
                            'sticky top-0 whitespace-nowrap border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold text-muted-foreground first:pl-4 last:pr-4',
                            meta.numeric ? 'text-right' : 'text-left',
                            meta.sticky ? 'left-0 z-20' : 'z-10',
                            meta.hideBelow && HIDE_BELOW[meta.hideBelow],
                          )}
                        >
                          {header.isPlaceholder ? null : header.column.getCanSort() ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className={cn(
                                'group/sort -mx-1 inline-flex items-center gap-1 rounded px-1 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                                sorted && 'text-foreground',
                                meta.numeric && 'flex-row-reverse',
                              )}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <SortIndicator direction={sorted} />
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody ref={bodyRef} className="[&>tr:last-child>td]:border-b-0">
                {loading
                  ? Array.from({ length: 6 }, (_, rowIndex) => (
                      <tr key={rowIndex}>
                        {selectable ? (
                          <td className={cn('border-b border-border', cellPadding)} />
                        ) : null}
                        {visibleColumns.map((column) => (
                          <SkeletonCell
                            key={column.id}
                            meta={presentation(column.columnDef.meta)}
                            padding={cellPadding}
                          />
                        ))}
                      </tr>
                    ))
                  : rows.map((row, index) => {
                      const selected = row.getIsSelected();
                      return (
                        <tr
                          key={row.id}
                          data-row
                          data-state={selected ? 'selected' : undefined}
                          tabIndex={index === focusIndex ? 0 : -1}
                          onFocus={() => setFocusIndex(index)}
                          onKeyDown={(event) =>
                            handleRowKeyDown(event, index, row.original, () => row.toggleSelected())
                          }
                          onDoubleClick={
                            onRowActivate ? () => onRowActivate(row.original) : undefined
                          }
                          className="group/row outline-none transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[state=selected]:bg-primary-subtle"
                        >
                          {selectable ? (
                            <td
                              className={cn(
                                'sticky left-0 z-[1] w-9 border-b border-border/70 bg-surface transition-colors group-hover/row:bg-surface-muted group-data-[state=selected]/row:bg-primary-subtle',
                                cellPadding,
                              )}
                            >
                              <Checkbox
                                aria-label="Select row"
                                checked={selected}
                                onCheckedChange={(checked) => row.toggleSelected(checked === true)}
                              />
                            </td>
                          ) : null}
                          {row.getVisibleCells().map((cell) => {
                            const meta = presentation(cell.column.columnDef.meta);
                            return (
                              <td
                                key={cell.id}
                                className={cn(
                                  'border-b border-border/70 align-middle',
                                  cellPadding,
                                  meta.numeric && 'num text-right',
                                  meta.sticky &&
                                    'sticky left-0 z-[1] bg-surface transition-colors group-hover/row:bg-surface-muted group-data-[state=selected]/row:bg-primary-subtle',
                                  meta.hideBelow && HIDE_BELOW[meta.hideBelow],
                                )}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
              </tbody>
            </table>
            {filteredOut ? (
              <EmptyState
                compact
                title="No rows match your filter"
                description="Clear the search to see everything loaded on this page."
              />
            ) : null}
          </div>
        )}
      </div>
      {showFooter && pagination ? (
        <div className="border-t border-border bg-surface-muted/70 px-3 py-2 md:px-4">
          <Pagination {...pagination} />
        </div>
      ) : null}
    </div>
  );
}
