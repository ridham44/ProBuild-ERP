'use client';

import { FileText } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import type { DataColumn } from '@/components/common/data-table/column-meta';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { FilterBar } from '@/components/common/filter-bar';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Select } from '@/components/ui/select';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import type { QuotationRow } from '@/lib/api/types';
import { formatDate, formatPHP } from '@/lib/format';
import { useListState } from '@/lib/list-state';
import { useQuotations } from '../api/hooks';

const INITIAL = { status: '' } as Record<string, string>;

export function QuotationsView() {
  const router = useRouter();
  const list = useListState(INITIAL);
  const quotations = useQuotations(list.query);
  const page = quotations.data;

  const columns = React.useMemo<DataColumn<QuotationRow>[]>(
    () => [
      {
        id: 'rfq',
        header: 'RFQ',
        accessorFn: (row) => row.rfq.number,
        enableSorting: true,
        meta: { sticky: true },
        cell: ({ row }) => (
          <Link href={`/procurement/rfqs/${row.original.rfqId}?tab=comparison`} className="doc-link">
            {row.original.rfq.number}
          </Link>
        ),
      },
      {
        id: 'supplier',
        header: 'Supplier',
        accessorFn: (row) => row.supplier.name,
        enableSorting: true,
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.supplier.name}</p>
            {row.original.quoteNo ? <p className="font-mono text-xs text-muted-foreground">{row.original.quoteNo}</p> : null}
          </div>
        ),
      },
      { id: 'date', header: 'Quoted', accessorFn: (row) => row.quoteDate, enableSorting: true, cell: ({ row }) => formatDate(row.original.quoteDate), meta: { hideBelow: 'sm' } },
      { id: 'valid', header: 'Valid until', cell: ({ row }) => (row.original.validUntil ? formatDate(row.original.validUntil) : 'Open'), meta: { hideBelow: 'md' } },
      { id: 'days', header: 'Lead time', cell: ({ row }) => (row.original.deliveryDays === null ? '—' : `${row.original.deliveryDays} days`), meta: { numeric: true, hideBelow: 'md' } },
      { id: 'total', header: 'Total', accessorFn: (row) => Number(row.totalAmount), enableSorting: true, cell: ({ row }) => formatPHP(row.original.totalAmount), meta: { numeric: true } },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [],
  );

  return (
    <PermissionGate module="procurement.rfq">
      <PageHeader
        title="Supplier quotations"
        description="Every quotation received against an RFQ. Open an RFQ to compare and award."
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Quotations' }]}
      />
      <DataTable
        caption="Supplier quotations"
        columns={columns}
        data={page?.items ?? []}
        getRowId={(row) => row.id}
        loading={quotations.isPending}
        error={quotations.error}
        onRetry={() => void quotations.refetch()}
        onRowActivate={(row) => router.push(`/procurement/rfqs/${row.rfqId}?tab=comparison`)}
        toolbar={
          <FilterBar activeCount={list.activeCount} onReset={list.clearFilters}>
            <div className="w-44">
              <Select aria-label="Status" value={list.filters.status ?? ''} onChange={(event) => list.setFilter('status', event.target.value)}>
                <option value="">All statuses</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="AWARDED">Awarded</option>
                <option value="NOT_AWARDED">Not awarded</option>
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
          loading: quotations.isFetching,
        }}
        emptyState={
          <EmptyState
            icon={FileText}
            title="No quotations yet"
            description="Quotations are entered on the RFQ once suppliers respond."
          />
        }
      />
    </PermissionGate>
  );
}
