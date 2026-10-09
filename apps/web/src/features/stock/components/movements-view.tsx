'use client';

import { MOVEMENT_TYPES, STOCK_STATUSES } from '@probuild/shared';
import { ArrowDownLeft, ArrowUpRight, History } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { ProjectScopeChip, useProjectScope } from '@/features/context/project-scope';
import { searchItemOptions } from '@/features/items/api/hooks';
import { searchWarehouseOptions } from '@/features/warehouses/api/hooks';
import type { MovementRow } from '@/lib/api/types';
import { formatDateTime, formatPHP, formatQty, titleCase } from '@/lib/format';
import { useListState } from '@/lib/list-state';
import { cn } from '@/lib/utils';
import { useStockMovements } from '../api/hooks';
import { movementReferenceHref } from '../model';

const INITIAL = { itemId: '', warehouseId: '', txnType: '', stockStatus: '', from: '', to: '' } as Record<string, string>;

function ReferenceCell({ movement }: { movement: MovementRow }) {
  const href = movementReferenceHref(movement.reference.type, movement.reference.id);
  const label = movement.reference.number ?? titleCase(movement.reference.type);
  if (!href) return <span className="text-xs text-muted-foreground">{label}</span>;
  return (
    <Link href={href} className="doc-link">
      {label}
    </Link>
  );
}

export function MovementsView() {
  const scope = useProjectScope();
  const list = useListState(INITIAL);
  const [itemLabel, setItemLabel] = React.useState('');
  const [warehouseLabel, setWarehouseLabel] = React.useState('');
  const movements = useStockMovements({ ...list.query, ...(scope.projectId ? { projectId: scope.projectId } : {}) });
  const page = movements.data;

  const columns = React.useMemo<DataColumn<MovementRow>[]>(
    () => [
      {
        id: 'txnDate',
        header: 'Date',
        cell: ({ row }) => (
          <div>
            <p>{formatDateTime(row.original.txnDate)}</p>
            <p className="font-mono text-xs text-subtle-foreground">{row.original.txnNo}</p>
          </div>
        ),
        meta: { sticky: true },
      },
      {
        id: 'item',
        header: 'Item',
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link href={`/inventory/items/${row.original.itemId}`} className="font-medium hover:underline">
              {row.original.item.name}
            </Link>
            <p className="font-mono text-xs text-muted-foreground">
              {row.original.item.sku}
              {row.original.batchNo ? ` · batch ${row.original.batchNo}` : ''}
              {row.original.serialNo ? ` · ${row.original.serialNo}` : ''}
            </p>
          </div>
        ),
      },
      { id: 'warehouse', header: 'Warehouse', cell: ({ row }) => row.original.warehouse.name, meta: { hideBelow: 'md' } },
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => {
          const inbound = row.original.direction === 'IN';
          const Icon = inbound ? ArrowDownLeft : ArrowUpRight;
          return (
            <Badge tone={inbound ? 'success' : 'neutral'}>
              <Icon className="size-3" aria-hidden />
              {titleCase(row.original.txnType)}
              <span className="sr-only">{inbound ? ' (in)' : ' (out)'}</span>
            </Badge>
          );
        },
        meta: { hideBelow: 'sm' },
      },
      {
        id: 'status',
        header: 'Stock status',
        cell: ({ row }) =>
          row.original.stockStatus === 'AVAILABLE' ? (
            <span className="text-muted-foreground">Available</span>
          ) : (
            <Badge tone="warning">{titleCase(row.original.stockStatus)}</Badge>
          ),
        meta: { hideBelow: 'lg' },
      },
      {
        id: 'qty',
        header: 'Quantity',
        cell: ({ row }) => (
          <span className={cn('font-semibold', row.original.direction === 'IN' ? 'text-success' : 'text-foreground')}>
            {row.original.direction === 'IN' ? '+' : ''}
            {formatQty(row.original.qty, row.original.item.baseUnit)}
          </span>
        ),
        meta: { numeric: true },
      },
      { id: 'running', header: 'Balance', cell: ({ row }) => formatQty(row.original.runningQty), meta: { numeric: true, hideBelow: 'lg' } },
      { id: 'value', header: 'Value', cell: ({ row }) => formatPHP(row.original.value), meta: { numeric: true, hideBelow: 'md' } },
      { id: 'reference', header: 'Reference', cell: ({ row }) => <ReferenceCell movement={row.original} />, meta: { hideBelow: 'sm' } },
    ],
    [],
  );

  const filtering = Boolean(list.debounced) || list.activeCount > 0 || Boolean(scope.projectId);
  return (
    <PermissionGate module="inventory.stock">
      <PageHeader
        title="Stock movements"
        description="Every receipt, issue, transfer and adjustment recorded in the stock ledger, newest first."
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Stock', href: '/inventory/stock' }, { label: 'Movements' }]}
        actions={
          <Button asChild>
            <Link href="/inventory/stock">Stock on hand</Link>
          </Button>
        }
      />
      <DataTable
        caption="Stock movements"
        columns={columns}
        data={page?.items ?? []}
        getRowId={(row) => row.id}
        loading={movements.isPending}
        error={movements.error}
        onRetry={() => void movements.refetch()}
        toolbar={
          <FilterBar
            activeCount={list.activeCount}
            onReset={() => {
              list.clearFilters();
              setItemLabel('');
              setWarehouseLabel('');
            }}
          >
            <SearchInput value={list.search} onValueChange={list.setSearch} placeholder="Search movements" />
            <ProjectScopeChip scope={scope} />
            <div className="w-56">
              <EntityCombobox
                entity="items"
                search={searchItemOptions}
                value={list.filters.itemId || null}
                selectedLabel={itemLabel}
                onChange={(value, option) => {
                  list.setFilter('itemId', value ?? '');
                  setItemLabel(option?.label ?? '');
                }}
                placeholder="Any item"
                aria-describedby={undefined}
              />
            </div>
            <div className="w-52">
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
            <div className="w-48">
              <Select aria-label="Movement type" value={list.filters.txnType ?? ''} onChange={(event) => list.setFilter('txnType', event.target.value)}>
                <option value="">All types</option>
                {MOVEMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {titleCase(type)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-40">
              <Select aria-label="Stock status" value={list.filters.stockStatus ?? ''} onChange={(event) => list.setFilter('stockStatus', event.target.value)}>
                <option value="">Any status</option>
                {STOCK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {titleCase(status)}
                  </option>
                ))}
              </Select>
            </div>
            <Input aria-label="From date" type="date" className="w-36" value={list.filters.from ?? ''} onChange={(event) => list.setFilter('from', event.target.value)} />
            <Input aria-label="To date" type="date" className="w-36" value={list.filters.to ?? ''} onChange={(event) => list.setFilter('to', event.target.value)} />
          </FilterBar>
        }
        pagination={{
          count: page?.items.length ?? 0,
          hasPrevious: list.paging.hasPrevious,
          hasNext: Boolean(page?.nextCursor),
          onPrevious: list.paging.goPrevious,
          onNext: () => list.paging.goNext(page?.nextCursor ?? null),
          loading: movements.isFetching,
        }}
        emptyState={
          <EmptyState
            icon={History}
            title={filtering ? 'No movements match these filters' : 'No stock movements yet'}
            description={filtering ? 'Clear the filters, or show every project.' : 'Movements are recorded when goods are received, issued or adjusted.'}
          />
        }
      />
    </PermissionGate>
  );
}
