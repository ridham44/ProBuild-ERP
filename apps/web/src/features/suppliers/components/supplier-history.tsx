'use client';

import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import type { DataColumn } from '@/components/common/data-table/column-meta';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { FilterBar } from '@/components/common/filter-bar';
import { useCursorPagination } from '@/components/common/pagination';
import { StatusBadge } from '@/components/common/status-badge';
import { Select } from '@/components/ui/select';
import { PO_STATUSES } from '@probuild/shared';
import type { SupplierPurchaseRow } from '@/lib/api/types';
import { formatDate, formatPHP, titleCase } from '@/lib/format';
import { useSupplierHistory } from '../api/hooks';

export function SupplierHistory({ supplierId }: { supplierId: string }) {
  const [status, setStatus] = React.useState('');
  const paging = useCursorPagination();
  const { reset } = paging;
  React.useEffect(() => reset(), [status, reset]);
  const history = useSupplierHistory(supplierId, {
    limit: 25,
    ...(status ? { status } : {}),
    ...(paging.cursor ? { cursor: paging.cursor } : {}),
  });
  const page = history.data;

  const columns = React.useMemo<DataColumn<SupplierPurchaseRow>[]>(
    () => [
      {
        id: 'number',
        header: 'PO number',
        enableSorting: true,
        accessorFn: (row) => row.number,
        cell: ({ row }) => (
          <Link
            href={`/procurement/orders/${row.original.id}`}
            className="doc-link"
          >
            {row.original.number}
          </Link>
        ),
        meta: { sticky: true },
      },
      {
        id: 'project',
        header: 'Project',
        cell: ({ row }) => (
          <span>
            <span className="font-mono text-xs text-muted-foreground">{row.original.project.code}</span>{' '}
            {row.original.project.name}
          </span>
        ),
        meta: { hideBelow: 'md' },
      },
      {
        id: 'orderDate',
        header: 'Ordered',
        enableSorting: true,
        accessorFn: (row) => row.orderDate,
        cell: ({ row }) => formatDate(row.original.orderDate),
      },
      {
        id: 'expected',
        header: 'Expected',
        cell: ({ row }) => formatDate(row.original.expectedDate),
        meta: { hideBelow: 'sm' },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'total',
        header: 'Total',
        enableSorting: true,
        accessorFn: (row) => Number(row.totalAmount),
        cell: ({ row }) => formatPHP(row.original.totalAmount),
        meta: { numeric: true },
      },
    ],
    [],
  );

  return (
    <DataTable
      caption="Purchase orders placed with this supplier"
      columns={columns}
      data={page?.items ?? []}
      getRowId={(row) => row.id}
      loading={history.isPending}
      error={history.error}
      onRetry={() => void history.refetch()}
      maxHeightClassName="max-h-[60vh]"
      toolbar={
        <FilterBar activeCount={status ? 1 : 0} onReset={() => setStatus('')}>
          <div className="w-48">
            <Select aria-label="Order status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              {PO_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </Select>
          </div>
        </FilterBar>
      }
      pagination={{
        count: page?.items.length ?? 0,
        hasPrevious: paging.hasPrevious,
        hasNext: Boolean(page?.nextCursor),
        onPrevious: paging.goPrevious,
        onNext: () => paging.goNext(page?.nextCursor ?? null),
        loading: history.isFetching,
      }}
      emptyState={
        <EmptyState
          compact
          icon={ShoppingCart}
          title={status ? 'No orders with that status' : 'No purchase orders yet'}
          description="Orders placed with this supplier appear here with their status and value."
        />
      }
    />
  );
}
