'use client';

import { Package, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import type { DataColumn } from '@/components/common/data-table/column-meta';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { FilterBar } from '@/components/common/filter-bar';
import { PageHeader } from '@/components/common/page-header';
import { SearchInput } from '@/components/common/search-input';
import { StatusBadge } from '@/components/common/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useCan } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import type { ItemRow } from '@/lib/api/types';
import { formatPHP, formatQty } from '@/lib/format';
import { useListState } from '@/lib/list-state';
import { useItemCategories, useItems } from '../api/hooks';
import { costingLabel, ITEM_TYPE_OPTIONS, trackingLabels } from '../model';

const INITIAL = { active: 'true', categoryId: '', itemType: '', tracking: '' } as Record<string, string>;

function trackingQuery(filters: Record<string, string | undefined>): Record<string, string> {
  const { tracking, ...rest } = filters;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(rest)) if (value) out[key] = value;
  if (tracking === 'batch') out.trackBatch = 'true';
  if (tracking === 'serial') out.trackSerial = 'true';
  return out;
}

export function ItemsView() {
  const router = useRouter();
  const canCreate = useCan('inventory.item', 'CREATE');
  const list = useListState(INITIAL);
  const categories = useItemCategories();
  const query = {
    limit: list.query.limit as number,
    ...(list.query.search ? { search: list.query.search } : {}),
    ...(list.query.cursor ? { cursor: list.query.cursor } : {}),
    ...trackingQuery(list.filters),
  };
  const items = useItems(query);
  const page = items.data;

  const columns = React.useMemo<DataColumn<ItemRow>[]>(
    () => [
      {
        id: 'sku',
        header: 'SKU',
        enableSorting: true,
        accessorFn: (row) => row.sku,
        cell: ({ row }) => (
          <Link
            href={`/inventory/items/${row.original.id}`}
            className="font-mono text-xs font-medium text-primary hover:underline"
          >
            {row.original.sku}
          </Link>
        ),
        meta: { sticky: true },
      },
      {
        id: 'name',
        header: 'Item',
        enableSorting: true,
        accessorFn: (row) => row.name,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{row.original.name}</p>
            {row.original.specification ? (
              <p className="max-w-80 truncate text-xs text-muted-foreground">{row.original.specification}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'category',
        header: 'Category',
        accessorFn: (row) => row.category?.name ?? '',
        enableSorting: true,
        cell: ({ row }) => row.original.category?.name ?? '—',
        meta: { hideBelow: 'md' },
      },
      {
        id: 'unit',
        header: 'Unit',
        accessorFn: (row) => row.baseUnit,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.baseUnit}</span>,
      },
      {
        id: 'tracking',
        header: 'Tracking',
        cell: ({ row }) => {
          const labels = trackingLabels(row.original);
          return labels.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className="flex gap-1">
              {labels.map((label) => (
                <Badge key={label} tone="info">
                  {label}
                </Badge>
              ))}
            </span>
          );
        },
        meta: { hideBelow: 'lg' },
      },
      {
        id: 'costing',
        header: 'Valuation',
        cell: ({ row }) => costingLabel(row.original.costingMethod),
        meta: { hideBelow: 'lg' },
      },
      {
        id: 'reorder',
        header: 'Reorder point',
        accessorFn: (row) => Number(row.reorderPoint),
        enableSorting: true,
        cell: ({ row }) => formatQty(row.original.reorderPoint, row.original.baseUnit),
        meta: { numeric: true, hideBelow: 'lg' },
      },
      {
        id: 'cost',
        header: 'Last cost',
        accessorFn: (row) => Number(row.lastPurchaseCost),
        enableSorting: true,
        cell: ({ row }) =>
          Number(row.original.lastPurchaseCost) > 0 ? formatPHP(row.original.lastPurchaseCost) : '—',
        meta: { numeric: true, hideBelow: 'md' },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.active ? 'ACTIVE' : 'INACTIVE'} />,
      },
    ],
    [],
  );

  const filtering = Boolean(list.debounced) || list.activeCount > 0;
  return (
    <PermissionGate module="inventory.item">
      <PageHeader
        title="Items"
        description="Materials, consumables and equipment the company buys, stores and issues."
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Items' }]}
        actions={
          canCreate ? (
            <Button asChild variant="primary">
              <Link href="/inventory/items/new">
                <Plus className="size-3.5" aria-hidden />
                New item
              </Link>
            </Button>
          ) : null
        }
      />
      <DataTable
        caption="Items"
        columns={columns}
        data={page?.items ?? []}
        getRowId={(row) => row.id}
        loading={items.isPending}
        error={items.error}
        onRetry={() => void items.refetch()}
        onRowActivate={(row) => router.push(`/inventory/items/${row.id}`)}
        toolbar={
          <FilterBar activeCount={list.activeCount} onReset={list.clearFilters}>
            <SearchInput value={list.search} onValueChange={list.setSearch} placeholder="Search by SKU or name" />
            <div className="w-44">
              <Select
                aria-label="Category"
                value={list.filters.categoryId ?? ''}
                onChange={(event) => list.setFilter('categoryId', event.target.value)}
              >
                <option value="">All categories</option>
                {(categories.data?.items ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-40">
              <Select
                aria-label="Item type"
                value={list.filters.itemType ?? ''}
                onChange={(event) => list.setFilter('itemType', event.target.value)}
              >
                <option value="">All types</option>
                {ITEM_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-36">
              <Select
                aria-label="Tracking"
                value={list.filters.tracking ?? ''}
                onChange={(event) => list.setFilter('tracking', event.target.value)}
              >
                <option value="">Any tracking</option>
                <option value="batch">Batch tracked</option>
                <option value="serial">Serial tracked</option>
              </Select>
            </div>
            <div className="w-28">
              <Select
                aria-label="Status"
                value={list.filters.active ?? ''}
                onChange={(event) => list.setFilter('active', event.target.value)}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
                <option value="">All</option>
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
          loading: items.isFetching,
        }}
        emptyState={
          <EmptyState
            icon={Package}
            title={filtering ? 'No items match these filters' : 'No items yet'}
            description={
              filtering
                ? 'Clear the filters or search for a different SKU or name.'
                : 'Create the cement, rebar, block and other materials you purchase. Requisitions, RFQs and stock all refer to these items.'
            }
            action={
              canCreate && !filtering ? (
                <Button asChild variant="primary">
                  <Link href="/inventory/items/new">
                    <Plus className="size-3.5" aria-hidden />
                    New item
                  </Link>
                </Button>
              ) : undefined
            }
          />
        }
      />
    </PermissionGate>
  );
}
