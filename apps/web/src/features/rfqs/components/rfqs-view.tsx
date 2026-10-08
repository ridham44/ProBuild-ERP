'use client';

import { RFQ_STATUSES } from '@probuild/shared';
import { Plus, SearchCheck } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useCan } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { ProjectScopeChip, useProjectScope } from '@/features/context/project-scope';
import type { RfqRow } from '@/lib/api/types';
import { formatDate, titleCase } from '@/lib/format';
import { useListState } from '@/lib/list-state';
import { useRfqs } from '../api/hooks';

const INITIAL = { status: '' } as Record<string, string>;

export function RfqsView() {
  const router = useRouter();
  const canCreate = useCan('procurement.rfq', 'CREATE');
  const scope = useProjectScope();
  const list = useListState(INITIAL);
  const rfqs = useRfqs({ ...list.query, ...(scope.projectId ? { projectId: scope.projectId } : {}) });
  const page = rfqs.data;

  const columns = React.useMemo<DataColumn<RfqRow>[]>(
    () => [
      {
        id: 'number',
        header: 'RFQ',
        enableSorting: true,
        accessorFn: (row) => row.number,
        cell: ({ row }) => (
          <Link href={`/procurement/rfqs/${row.original.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
            {row.original.number}
          </Link>
        ),
        meta: { sticky: true },
      },
      {
        id: 'project',
        header: 'Project',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p>{row.original.project.name}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.requisition ? `From ${row.original.requisition.number}` : row.original.project.code}
            </p>
          </div>
        ),
      },
      { id: 'lines', header: 'Lines', accessorFn: (row) => row._count.lines, cell: ({ row }) => row.original._count.lines, meta: { numeric: true, hideBelow: 'sm' } },
      {
        id: 'quotes',
        header: 'Quotes received',
        cell: ({ row }) => `${row.original._count.quotations} of ${row.original._count.suppliers}`,
        meta: { numeric: true },
      },
      {
        id: 'due',
        header: 'Quotes due',
        accessorFn: (row) => row.dueDate ?? '',
        enableSorting: true,
        cell: ({ row }) => formatDate(row.original.dueDate),
        meta: { hideBelow: 'md' },
      },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'created',
        header: 'Created',
        accessorFn: (row) => row.createdAt,
        enableSorting: true,
        cell: ({ row }) => formatDate(row.original.createdAt),
        meta: { hideBelow: 'lg' },
      },
    ],
    [],
  );

  const filtering = Boolean(list.debounced) || list.activeCount > 0 || Boolean(scope.projectId);
  return (
    <PermissionGate module="procurement.rfq">
      <PageHeader
        title="Requests for quotation"
        description="Invite suppliers to quote approved requisition lines, compare their offers and award one."
        breadcrumbs={[{ label: 'Procurement' }, { label: 'RFQs' }]}
        actions={
          canCreate ? (
            <Button asChild variant="primary">
              <Link href="/procurement/rfqs/new">
                <Plus className="size-3.5" aria-hidden />
                New RFQ
              </Link>
            </Button>
          ) : null
        }
      />
      <DataTable
        caption="Requests for quotation"
        columns={columns}
        data={page?.items ?? []}
        getRowId={(row) => row.id}
        loading={rfqs.isPending}
        error={rfqs.error}
        onRetry={() => void rfqs.refetch()}
        onRowActivate={(row) => router.push(`/procurement/rfqs/${row.id}`)}
        toolbar={
          <FilterBar activeCount={list.activeCount} onReset={list.clearFilters}>
            <SearchInput value={list.search} onValueChange={list.setSearch} placeholder="Search RFQ number" />
            <ProjectScopeChip scope={scope} />
            <div className="w-40">
              <Select aria-label="Status" value={list.filters.status ?? ''} onChange={(event) => list.setFilter('status', event.target.value)}>
                <option value="">All statuses</option>
                {RFQ_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {titleCase(status)}
                  </option>
                ))}
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
          loading: rfqs.isFetching,
        }}
        emptyState={
          <EmptyState
            icon={SearchCheck}
            title={filtering ? 'No RFQs match these filters' : 'No RFQs yet'}
            description={
              filtering
                ? 'Clear the filters, or show every project.'
                : 'Create an RFQ from an approved requisition to ask suppliers for prices.'
            }
            action={
              canCreate && !filtering ? (
                <Button asChild variant="primary">
                  <Link href="/procurement/rfqs/new">
                    <Plus className="size-3.5" aria-hidden />
                    New RFQ
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
