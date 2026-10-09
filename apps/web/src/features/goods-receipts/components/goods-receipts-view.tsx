'use client';

import { GRN_STATUSES } from '@probuild/shared';
import { PackageCheck, Plus } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useCan } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { ProjectScopeChip, useProjectScope } from '@/features/context/project-scope';
import { searchSupplierOptions } from '@/features/suppliers/api/hooks';
import type { GoodsReceiptRow } from '@/lib/api/types';
import { formatDate, titleCase } from '@/lib/format';
import { useListState } from '@/lib/list-state';
import { useGoodsReceipts } from '../api/hooks';

const INITIAL = { status: '', supplierId: '' } as Record<string, string>;

export function GoodsReceiptsView() {
  const router = useRouter();
  const scope = useProjectScope();
  const canCreate = useCan('procurement.receipt', 'CREATE');
  const list = useListState(INITIAL);
  const [supplierLabel, setSupplierLabel] = React.useState('');
  const receipts = useGoodsReceipts({ ...list.query, ...(scope.projectId ? { projectId: scope.projectId } : {}) });
  const page = receipts.data;

  const columns = React.useMemo<DataColumn<GoodsReceiptRow>[]>(
    () => [
      {
        id: 'number',
        header: 'Receipt',
        cell: ({ row }) => (
          <Link href={`/inventory/receipts/${row.original.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
            {row.original.number}
          </Link>
        ),
        meta: { sticky: true },
      },
      {
        id: 'supplier',
        header: 'Supplier',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{row.original.supplier.name}</p>
            <p className="text-xs text-muted-foreground">
              <Link href={`/procurement/orders/${row.original.orderId}`} className="font-mono hover:underline">
                {row.original.order.number}
              </Link>
              {row.original.supplierDrNo ? ` · DR ${row.original.supplierDrNo}` : ''}
            </p>
          </div>
        ),
      },
      { id: 'warehouse', header: 'Warehouse', cell: ({ row }) => row.original.warehouse.name, meta: { hideBelow: 'md' } },
      { id: 'receiptDate', header: 'Received', cell: ({ row }) => formatDate(row.original.receiptDate), meta: { hideBelow: 'sm' } },
      { id: 'lines', header: 'Lines', cell: ({ row }) => row.original._count.lines, meta: { numeric: true, hideBelow: 'lg' } },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'posted',
        header: 'Posted',
        cell: ({ row }) => (row.original.postedAt ? formatDate(row.original.postedAt) : '—'),
        meta: { hideBelow: 'lg' },
      },
    ],
    [],
  );

  const filtering = Boolean(list.debounced) || list.activeCount > 0 || Boolean(scope.projectId);
  return (
    <PermissionGate module="procurement.receipt">
      <PageHeader
        title="Goods receipts"
        description="Deliveries received against purchase orders, with quality inspection before stock is posted."
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Goods receipts' }]}
        actions={
          canCreate ? (
            <Button asChild variant="primary">
              <Link href="/inventory/receipts/new">
                <Plus className="size-3.5" aria-hidden />
                New receipt
              </Link>
            </Button>
          ) : null
        }
      />
      <DataTable
        caption="Goods receipts"
        columns={columns}
        data={page?.items ?? []}
        getRowId={(row) => row.id}
        loading={receipts.isPending}
        error={receipts.error}
        onRetry={() => void receipts.refetch()}
        onRowActivate={(row) => router.push(`/inventory/receipts/${row.id}`)}
        toolbar={
          <FilterBar
            activeCount={list.activeCount}
            onReset={() => {
              list.clearFilters();
              setSupplierLabel('');
            }}
          >
            <SearchInput value={list.search} onValueChange={list.setSearch} placeholder="Search receipt, DR number, driver" />
            <ProjectScopeChip scope={scope} />
            <div className="w-44">
              <Select aria-label="Status" value={list.filters.status ?? ''} onChange={(event) => list.setFilter('status', event.target.value)}>
                <option value="">All statuses</option>
                {GRN_STATUSES.map((status) => (
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
          loading: receipts.isFetching,
        }}
        emptyState={
          <EmptyState
            icon={PackageCheck}
            title={filtering ? 'No goods receipts match these filters' : 'No goods receipts yet'}
            description={
              filtering
                ? 'Clear the filters, or show every project.'
                : 'Record a delivery against an approved or sent purchase order to create the first receipt.'
            }
          />
        }
      />
    </PermissionGate>
  );
}
