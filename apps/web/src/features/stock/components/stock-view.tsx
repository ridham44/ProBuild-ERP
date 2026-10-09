'use client';

import { Boxes } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import type { DataColumn } from '@/components/common/data-table/column-meta';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { EntityCombobox } from '@/components/common/entity-combobox';
import { FilterBar } from '@/components/common/filter-bar';
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
  return <span className={Number(value) === 0 ? 'text-muted-foreground' : undefined}>{formatQty(value, unit)}</span>;
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
            <Link href={`/inventory/items/${row.original.itemId}`} className="font-medium hover:underline">
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
          <Link href={`/inventory/warehouses/${row.original.warehouseId}`} className="hover:underline">
            {row.original.warehouseName}
          </Link>
        ),
        meta: { hideBelow: 'sm' },
      },
      { id: 'onHand', header: 'On hand', cell: ({ row }) => qtyCell(row.original.onHand, row.original.baseUnit), meta: { numeric: true } },
      { id: 'reserved', header: 'Reserved', cell: ({ row }) => qtyCell(row.original.reserved, row.original.baseUnit), meta: { numeric: true, hideBelow: 'md' } },
      {
        id: 'available',
        header: 'Available',
        cell: ({ row }) => <span className="font-medium">{formatQty(row.original.available, row.original.baseUnit)}</span>,
        meta: { numeric: true },
      },
      { id: 'quarantine', header: 'Quarantine', cell: ({ row }) => qtyCell(row.original.quarantine, row.original.baseUnit), meta: { numeric: true, hideBelow: 'lg' } },
      { id: 'damaged', header: 'Damaged', cell: ({ row }) => qtyCell(row.original.damaged, row.original.baseUnit), meta: { numeric: true, hideBelow: 'lg' } },
      { id: 'committed', header: 'On order', cell: ({ row }) => qtyCell(row.original.committed, row.original.baseUnit), meta: { numeric: true, hideBelow: 'lg' } },
      {
        id: 'level',
        header: 'Level',
        cell: ({ row }) =>
          row.original.belowMinimum ? (
            <Badge tone="warning">Below minimum {formatQty(row.original.minStock)}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
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
        description="Quantity and value of every item by warehouse. On hand is available stock; quarantine and damaged stock are shown beside it."
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Stock' }]}
        actions={
          <Button asChild>
            <Link href="/inventory/movements">Stock movements</Link>
          </Button>
        }
      />
      <DataTable
        caption="Stock on hand"
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
