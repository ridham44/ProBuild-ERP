'use client';

import { AlertTriangle, Boxes } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import type { DataColumn } from '@/components/common/data-table/column-meta';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { EntityCombobox } from '@/components/common/entity-combobox';
import { FilterBar } from '@/components/common/filter-bar';
import { StackedBar } from '@/components/common/meter';
import { PageHeader } from '@/components/common/page-header';
import { SearchInput } from '@/components/common/search-input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { searchWarehouseOptions } from '@/features/warehouses/api/hooks';
import type { StockBalanceRow } from '@/lib/api/types';
import { formatPHP, formatQty } from '@/lib/format';
import { useListState } from '@/lib/list-state';
import { useStockBalances } from '../api/hooks';

const INITIAL = { warehouseId: '', belowMinimum: '', hideEmpty: 'true' } as Record<string, string>;

function qtyCell(value: string, unit: string) {
  return <span className={Number(value) === 0 ? 'text-subtle-foreground' : undefined}>{formatQty(value, unit)}</span>;
}

/** On hand split into what is free to issue and what approved material requests have reserved. */
function Availability({ row }: { row: StockBalanceRow }) {
  const onHand = Number(row.onHand);
  const reserved = Number(row.reserved);
  const available = Number(row.available);
  const overReserved = available < 0;
  return (
    <div className="ml-auto w-36 space-y-1">
      <p className={overReserved ? 'font-semibold text-danger' : 'font-semibold'}>
        {formatQty(row.available, row.baseUnit)}
      </p>
      {onHand > 0 || reserved > 0 ? (
        <StackedBar
          label={`${row.name} at ${row.warehouseName}`}
          total={Math.max(onHand, reserved)}
          segments={[
            { label: 'Free', value: Math.max(available, 0), tone: 'accent' },
            { label: 'Reserved', value: Math.min(reserved, onHand), tone: 'pending' },
            ...(overReserved ? [{ label: 'Over-reserved', value: -available, tone: 'danger' as const }] : []),
          ]}
        />
      ) : null}
    </div>
  );
}

const LEGEND: Array<{ term: string; meaning: string; dot?: string }> = [
  { term: 'On hand', meaning: 'usable stock in the warehouse' },
  { term: 'Reserved', meaning: 'approved material requests not yet issued', dot: 'bg-pending' },
  { term: 'Available', meaning: 'on hand minus reserved', dot: 'bg-accent' },
  { term: 'On order', meaning: 'open purchase orders, not yet received' },
];

function QuantityLegend() {
  return (
    <dl className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5 rounded-lg bg-surface-sunken/60 px-4 py-2.5 text-xs text-muted-foreground">
      {LEGEND.map((entry) => (
        <div key={entry.term} className="flex items-center gap-1.5">
          {entry.dot ? <span className={`size-2 rounded-full ${entry.dot}`} aria-hidden /> : null}
          <dt className="font-semibold text-foreground">{entry.term}</dt>
          <dd>{entry.meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StockView() {
  const list = useListState(INITIAL);
  const [warehouseLabel, setWarehouseLabel] = React.useState('');
  const balances = useStockBalances(list.query);
  const page = balances.data;

  const columns = React.useMemo<DataColumn<StockBalanceRow>[]>(
    () => [
      {
        id: 'item',
        header: 'Item',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link href={`/inventory/items/${row.original.itemId}`} className="block max-w-64 truncate font-medium hover:text-primary hover:underline">
              {row.original.name}
            </Link>
            <p className="font-mono text-xs text-muted-foreground">{row.original.sku}</p>
          </div>
        ),
        meta: { sticky: true },
      },
      {
        id: 'warehouse',
        header: 'Warehouse',
        cell: ({ row }) => (
          <div>
            <Link href={`/inventory/warehouses/${row.original.warehouseId}`} className="hover:text-primary hover:underline">
              {row.original.warehouseName}
            </Link>
            <p className="font-mono text-xs text-subtle-foreground">{row.original.warehouseCode}</p>
          </div>
        ),
        meta: { hideBelow: 'sm' },
      },
      { id: 'onHand', header: 'On hand', cell: ({ row }) => qtyCell(row.original.onHand, row.original.baseUnit), meta: { numeric: true } },
      { id: 'reserved', header: 'Reserved', cell: ({ row }) => qtyCell(row.original.reserved, row.original.baseUnit), meta: { numeric: true, hideBelow: 'md' } },
      {
        id: 'available',
        header: 'Available',
        cell: ({ row }) => <Availability row={row.original} />,
        meta: { numeric: true },
      },
      { id: 'quarantine', header: 'Quarantine', cell: ({ row }) => qtyCell(row.original.quarantine, row.original.baseUnit), meta: { numeric: true, hideBelow: 'lg' } },
      { id: 'damaged', header: 'Damaged', cell: ({ row }) => qtyCell(row.original.damaged, row.original.baseUnit), meta: { numeric: true, hideBelow: 'lg' } },
      { id: 'committed', header: 'On order', cell: ({ row }) => qtyCell(row.original.committed, row.original.baseUnit), meta: { numeric: true, hideBelow: 'lg' } },
      { id: 'inTransit', header: 'In transit', cell: ({ row }) => qtyCell(row.original.inTransit, row.original.baseUnit), meta: { numeric: true, hideBelow: 'lg' } },
      {
        id: 'level',
        header: 'Level',
        cell: ({ row }) =>
          row.original.belowMinimum ? (
            <Badge tone="warning">
              <AlertTriangle className="size-3" aria-hidden />
              Below min. <span className="num">{formatQty(row.original.minStock)}</span>
            </Badge>
          ) : Number(row.original.minStock) > 0 ? (
            <span className="text-xs text-subtle-foreground">
              Min. <span className="num">{formatQty(row.original.minStock)}</span>
            </span>
          ) : (
            <span className="text-subtle-foreground">—</span>
          ),
        meta: { hideBelow: 'md' },
      },
      { id: 'avgCost', header: 'Avg. cost', cell: ({ row }) => formatPHP(row.original.avgCost), meta: { numeric: true, hideBelow: 'lg' } },
      { id: 'value', header: 'Value', cell: ({ row }) => <span className="font-medium">{formatPHP(row.original.value)}</span>, meta: { numeric: true } },
    ],
    [],
  );

  const filtering = Boolean(list.debounced) || list.activeCount > 0;
  return (
    <PermissionGate module="inventory.stock">
      <PageHeader
        title="Stock on hand"
        description="Quantity and value of every item by warehouse, in base units. Quarantined and damaged stock is held apart from on hand; value covers all of it."
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Stock' }]}
        actions={
          <Button asChild>
            <Link href="/inventory/movements">Stock movements</Link>
          </Button>
        }
      />
      <QuantityLegend />
      <DataTable
        caption="Stock on hand"
        initialVisibility={{ inTransit: false }}
        columns={columns}
        data={page?.items ?? []}
        getRowId={(row) => `${row.itemId}:${row.warehouseId}`}
        loading={balances.isPending}
        error={balances.error}
        onRetry={() => void balances.refetch()}
        toolbar={
          <FilterBar
            activeCount={list.activeCount}
            onReset={() => {
              list.clearFilters();
              setWarehouseLabel('');
            }}
          >
            <SearchInput value={list.search} onValueChange={list.setSearch} placeholder="Search SKU or item" />
            <div className="w-56">
              <EntityCombobox
                entity="warehouses"
                search={searchWarehouseOptions}
                value={list.filters.warehouseId || null}
                selectedLabel={warehouseLabel}
                onChange={(value, option) => {
                  list.setFilter('warehouseId', value ?? '');
                  setWarehouseLabel(option?.label ?? '');
                }}
                placeholder="All warehouses"
                aria-describedby={undefined}
              />
            </div>
            <div className="w-44">
              <Select aria-label="Stock level" value={list.filters.belowMinimum ?? ''} onChange={(event) => list.setFilter('belowMinimum', event.target.value)}>
                <option value="">Any level</option>
                <option value="true">Below minimum</option>
              </Select>
            </div>
            <div className="w-44">
              <Select aria-label="Empty rows" value={list.filters.hideEmpty ?? ''} onChange={(event) => list.setFilter('hideEmpty', event.target.value)}>
                <option value="true">Hide empty rows</option>
                <option value="">Show empty rows</option>
              </Select>
            </div>
          </FilterBar>
        }
        pagination={{
          count: page?.items.length ?? 0,
          hasPrevious: list.paging.hasPrevious,
          hasNext: Boolean(page?.nextCursor),
          onPrevious: list.paging.goPrevious,
          onNext: () => list.paging.goNext(page?.nextCursor ?? null),
          loading: balances.isFetching,
        }}
        emptyState={
          <EmptyState
            icon={Boxes}
            title={filtering ? 'No stock matches these filters' : 'No stock on hand yet'}
            description={filtering ? 'Clear the filters to see every item.' : 'Stock appears once goods are received into a warehouse.'}
          />
        }
      />
    </PermissionGate>
  );
}
