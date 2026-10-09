'use client';

import { MR_STATUSES } from '@probuild/shared';
import { ClipboardCheck, Plus, Warehouse } from 'lucide-react';
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
import type { MaterialRequestRow } from '@/lib/api/types';
import { formatDate, formatPHP, titleCase } from '@/lib/format';
import { useListState } from '@/lib/list-state';
import { useMaterialRequests } from '../api/hooks';
import { documentStatusKey } from '../model';

const INITIAL = { status: '' } as Record<string, string>;

export function MaterialRequestsView() {
  const router = useRouter();
  const scope = useProjectScope();
  const canCreate = useCan('inventory.request', 'CREATE');
  const list = useListState(INITIAL);
  const requests = useMaterialRequests({ ...list.query, ...(scope.projectId ? { projectId: scope.projectId } : {}) });
  const page = requests.data;

  const columns = React.useMemo<DataColumn<MaterialRequestRow>[]>(
    () => [
      {
        id: 'number',
        header: 'Request',
        cell: ({ row }) => (
          <Link href={`/inventory/material-requests/${row.original.id}`} className="doc-link">
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
            <p className="font-medium">{row.original.project.name}</p>
            <p className="truncate text-xs text-muted-foreground">{row.original.purpose ?? row.original.project.code}</p>
          </div>
        ),
      },
      {
        id: 'warehouse',
        header: 'Issue from',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5">
            <Warehouse className="size-3.5 shrink-0 text-accent" aria-hidden />
            {row.original.warehouse.name}
          </span>
        ),
        meta: { hideBelow: 'md' },
      },
      { id: 'needed', header: 'Needed by', cell: ({ row }) => formatDate(row.original.neededDate), meta: { hideBelow: 'sm' } },
      { id: 'lines', header: 'Lines', cell: ({ row }) => row.original._count.lines, meta: { numeric: true, hideBelow: 'lg' } },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={documentStatusKey(row.original.status)} /> },
      {
        id: 'estimated',
        header: 'Estimated',
        cell: ({ row }) => <span className="font-medium">{formatPHP(row.original.estimatedTotal)}</span>,
        meta: { numeric: true, hideBelow: 'md' },
      },
    ],
    [],
  );

  const filtering = Boolean(list.debounced) || list.activeCount > 0 || Boolean(scope.projectId);
  return (
    <PermissionGate module="inventory.request">
      <PageHeader
        title="Material requests"
        description="Requests for material from a warehouse to a project, approved before anything is issued."
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Material requests' }]}
        actions={
          canCreate ? (
            <Button asChild variant="primary">
              <Link href="/inventory/material-requests/new">
                <Plus className="size-3.5" aria-hidden />
                New request
              </Link>
            </Button>
          ) : null
        }
      />
      <DataTable
        caption="Material requests"
        columns={columns}
        data={page?.items ?? []}
        getRowId={(row) => row.id}
        loading={requests.isPending}
        error={requests.error}
        onRetry={() => void requests.refetch()}
        onRowActivate={(row) => router.push(`/inventory/material-requests/${row.id}`)}
        toolbar={
          <FilterBar activeCount={list.activeCount} onReset={list.clearFilters}>
            <SearchInput value={list.search} onValueChange={list.setSearch} placeholder="Search request number" />
            <ProjectScopeChip scope={scope} />
            <div className="w-44">
              <Select aria-label="Status" value={list.filters.status ?? ''} onChange={(event) => list.setFilter('status', event.target.value)}>
                <option value="">All statuses</option>
                {MR_STATUSES.map((status) => (
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
          loading: requests.isFetching,
        }}
        emptyState={
          <EmptyState
            icon={ClipboardCheck}
            title={filtering ? 'No material requests match these filters' : 'No material requests yet'}
            description={filtering ? 'Clear the filters, or show every project.' : 'Raise a request when a project needs material from a warehouse.'}
          />
        }
      />
    </PermissionGate>
  );
}
