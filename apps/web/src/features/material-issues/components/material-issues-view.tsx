'use client';

import { MI_STATUSES } from '@probuild/shared';
import { PackageMinus, Plus, Warehouse } from 'lucide-react';
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
import type { MaterialIssueRow } from '@/lib/api/types';
import { formatDate, formatPHP, titleCase } from '@/lib/format';
import { useListState } from '@/lib/list-state';
import { useMaterialIssues } from '../api/hooks';

const INITIAL = { status: '' } as Record<string, string>;

export function MaterialIssuesView() {
  const router = useRouter();
  const scope = useProjectScope();
  const canCreate = useCan('inventory.issue', 'CREATE');
  const list = useListState(INITIAL);
  const issues = useMaterialIssues({ ...list.query, ...(scope.projectId ? { projectId: scope.projectId } : {}) });
  const page = issues.data;

  const columns = React.useMemo<DataColumn<MaterialIssueRow>[]>(
    () => [
      {
        id: 'number',
        header: 'Issue',
        cell: ({ row }) => (
          <Link href={`/inventory/material-issues/${row.original.id}`} className="doc-link">
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
            <p className="text-xs text-muted-foreground">
              {row.original.request ? `Request ${row.original.request.number}` : 'Direct issue'}
            </p>
          </div>
        ),
      },
      {
        id: 'warehouse',
        header: 'Issued from',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5">
            <Warehouse className="size-3.5 shrink-0 text-accent" aria-hidden />
            {row.original.warehouse.name}
          </span>
        ),
        meta: { hideBelow: 'md' },
      },
      { id: 'issueDate', header: 'Issued', cell: ({ row }) => formatDate(row.original.issueDate), meta: { hideBelow: 'sm' } },
      { id: 'lines', header: 'Lines', cell: ({ row }) => row.original._count.lines, meta: { numeric: true, hideBelow: 'lg' } },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'cost',
        header: 'Cost',
        cell: ({ row }) => (row.original.status === 'POSTED' ? <span className="font-medium">{formatPHP(row.original.totalCost)}</span> : '—'),
        meta: { numeric: true, hideBelow: 'md' },
      },
    ],
    [],
  );

  const filtering = Boolean(list.debounced) || list.activeCount > 0 || Boolean(scope.projectId);
  return (
    <PermissionGate module="inventory.issue">
      <PageHeader
        title="Material issues"
        description="Material released from a warehouse to a project. Posting an issue charges its cost to the project."
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Material issues' }]}
        actions={
          canCreate ? (
            <Button asChild variant="primary">
              <Link href="/inventory/material-issues/new">
                <Plus className="size-3.5" aria-hidden />
                New issue
              </Link>
            </Button>
          ) : null
        }
      />
      <DataTable
        caption="Material issues"
        columns={columns}
        data={page?.items ?? []}
        getRowId={(row) => row.id}
        loading={issues.isPending}
        error={issues.error}
        onRetry={() => void issues.refetch()}
        onRowActivate={(row) => router.push(`/inventory/material-issues/${row.id}`)}
        toolbar={
          <FilterBar activeCount={list.activeCount} onReset={list.clearFilters}>
            <SearchInput value={list.search} onValueChange={list.setSearch} placeholder="Search issue number" />
            <ProjectScopeChip scope={scope} />
            <div className="w-44">
              <Select aria-label="Status" value={list.filters.status ?? ''} onChange={(event) => list.setFilter('status', event.target.value)}>
                <option value="">All statuses</option>
                {MI_STATUSES.map((status) => (
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
          loading: issues.isFetching,
        }}
        emptyState={
          <EmptyState
            icon={PackageMinus}
            title={filtering ? 'No material issues match these filters' : 'No material issues yet'}
            description={filtering ? 'Clear the filters, or show every project.' : 'Issue material against an approved request to create the first one.'}
          />
        }
      />
    </PermissionGate>
  );
}
