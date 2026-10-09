'use client';

import { PO_STATUSES } from '@probuild/shared';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import type { DataColumn } from '@/components/common/data-table/column-meta';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { EntityCombobox } from '@/components/common/entity-combobox';
import { FilterBar } from '@/components/common/filter-bar';
import { PageHeader } from '@/components/common/page-header';
import { SearchInput } from '@/components/common/search-input';
import { StatusBadge } from '@/components/common/status-badge';
import { Select } from '@/components/ui/select';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { ProjectScopeChip, useProjectScope } from '@/features/context/project-scope';
import { searchSupplierOptions } from '@/features/suppliers/api/hooks';
import type { PurchaseOrderRow } from '@/lib/api/types';
import { formatDate, formatPHP, titleCase } from '@/lib/format';
import { useListState } from '@/lib/list-state';
import { usePurchaseOrders } from '../api/hooks';

const INITIAL = { status: '', supplierId: '' } as Record<string, string>;

export function PurchaseOrdersView() {
  const router = useRouter();
  const scope = useProjectScope();
  const list = useListState(INITIAL);
  const [supplierLabel, setSupplierLabel] = React.useState('');
  const orders = usePurchaseOrders({ ...list.query, ...(scope.projectId ? { projectId: scope.projectId } : {}) });
  const page = orders.data;

  const columns = React.useMemo<DataColumn<PurchaseOrderRow>[]>(
    () => [
      {
        id: 'number',
        header: 'PO number',
        enableSorting: true,
        accessorFn: (row) => row.number,
        cell: ({ row }) => (
          <Link href={`/procurement/orders/${row.original.id}`} className="doc-link">
            {row.original.number}
          </Link>
        ),
        meta: { sticky: true },
      },
      {
        id: 'supplier',
        header: 'Supplier',
        accessorFn: (row) => row.supplier.name,
        enableSorting: true,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{row.original.supplier.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.project.code} · {row.original.project.name}</p>
          </div>
        ),
      },
      { id: 'warehouse', header: 'Deliver to', cell: ({ row }) => row.original.warehouse.name, meta: { hideBelow: 'lg' } },
      {
        id: 'orderDate',
        header: 'Ordered',
        accessorFn: (row) => row.orderDate,
        enableSorting: true,
        cell: ({ row }) => formatDate(row.original.orderDate),
        meta: { hideBelow: 'sm' },
      },
      {
        id: 'expected',
        header: 'Expected',
        accessorFn: (row) => row.expectedDate ?? '',
        enableSorting: true,
        cell: ({ row }) => formatDate(row.original.expectedDate),
        meta: { hideBelow: 'md' },
      },
      { id: 'lines', header: 'Lines', accessorFn: (row) => row._count.lines, cell: ({ row }) => row.original._count.lines, meta: { numeric: true, hideBelow: 'lg' } },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'total',
        header: 'Total',
        accessorFn: (row) => Number(row.totalAmount),
        enableSorting: true,
        cell: ({ row }) => <span className="font-medium">{formatPHP(row.original.totalAmount)}</span>,
        meta: { numeric: true },
      },
    ],
    [],
  );

  const filtering = Boolean(list.debounced) || list.activeCount > 0 || Boolean(scope.projectId);
  return (
    <PermissionGate module="procurement.order">
      <PageHeader
        title="Purchase orders"
        description="Orders placed with suppliers, from draft through approval to receipt."
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Purchase orders' }]}
      />
      <DataTable
        caption="Purchase orders"
        columns={columns}
        data={page?.items ?? []}
        getRowId={(row) => row.id}
        loading={orders.isPending}
        error={orders.error}
        onRetry={() => void orders.refetch()}
        onRowActivate={(row) => router.push(`/procurement/orders/${row.id}`)}
        toolbar={
          <FilterBar
            activeCount={list.activeCount}
            onReset={() => {
              list.clearFilters();
              setSupplierLabel('');
            }}
          >
            <SearchInput value={list.search} onValueChange={list.setSearch} placeholder="Search PO number" />
            <ProjectScopeChip scope={scope} />
            <div className="w-44">
              <Select aria-label="Status" value={list.filters.status ?? ''} onChange={(event) => list.setFilter('status', event.target.value)}>
                <option value="">All statuses</option>
                {PO_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {titleCase(status)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-56">
              <EntityCombobox
                entity="suppliers"
                search={searchSupplierOptions}
                value={list.filters.supplierId || null}
                selectedLabel={supplierLabel}
                onChange={(value, option) => {
                  list.setFilter('supplierId', value ?? '');
                  setSupplierLabel(option?.label ?? '');
                }}
                placeholder="Any supplier"
                aria-describedby={undefined}
              />
            </div>
          </FilterBar>
        }
        pagination={{
          count: page?.items.length ?? 0,
          hasPrevious: list.paging.hasPrevious,
          hasNext: Boolean(page?.nextCursor),
          onPrevious: list.paging.goPrevious,
          onNext: () => list.paging.goNext(page?.nextCursor ?? null),
          loading: orders.isFetching,
        }}
        emptyState={
          <EmptyState
            icon={ShoppingCart}
            title={filtering ? 'No purchase orders match these filters' : 'No purchase orders yet'}
            description={
              filtering
                ? 'Clear the filters, or show every project.'
                : 'Purchase orders are created from an awarded RFQ. Award a quotation to raise the first one.'
            }
          />
        }
      />
    </PermissionGate>
  );
}
