'use client';

import { PRIORITIES, PR_STATUSES } from '@probuild/shared';
import { ClipboardList, Plus } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCan, useCurrentUser } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { ProjectScopeChip, useProjectScope } from '@/features/context/project-scope';
import type { RequisitionRow } from '@/lib/api/types';
import { formatDate, formatPHP, titleCase } from '@/lib/format';
import { useListState } from '@/lib/list-state';
import { useRequisitions } from '../api/hooks';
import { prStatusKey } from '../model';

const INITIAL = { status: '', priority: '' } as Record<string, string>;

export function PriorityBadge({ priority }: { priority: string }) {
  const tone = priority === 'URGENT' ? 'danger' : priority === 'HIGH' ? 'warning' : 'neutral';
  return <Badge tone={tone}>{titleCase(priority)}</Badge>;
}

export function RequisitionsView() {
  const router = useRouter();
  const me = useCurrentUser();
  const canCreate = useCan('procurement.requisition', 'CREATE');
  const scope = useProjectScope();
  const list = useListState(INITIAL);
  const [mine, setMine] = React.useState(false);
  const requisitions = useRequisitions({
    ...list.query,
    ...(scope.projectId ? { projectId: scope.projectId } : {}),
    ...(mine ? { requesterId: me.id } : {}),
  });
  const page = requisitions.data;

  const columns = React.useMemo<DataColumn<RequisitionRow>[]>(
    () => [
      {
        id: 'number',
        header: 'Request',
        enableSorting: true,
        accessorFn: (row) => row.number,
        cell: ({ row }) => (
          <Link href={`/procurement/requests/${row.original.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
            {row.original.number}
          </Link>
        ),
        meta: { sticky: true },
      },
      {
        id: 'purpose',
        header: 'Purpose',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="max-w-80 truncate">{row.original.purpose ?? <span className="text-muted-foreground">No purpose stated</span>}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.project.code} · {row.original.project.name}
            </p>
          </div>
        ),
      },
      { id: 'priority', header: 'Priority', cell: ({ row }) => <PriorityBadge priority={row.original.priority} />, meta: { hideBelow: 'md' } },
      {
        id: 'needed',
        header: 'Needed by',
        accessorFn: (row) => row.requiredDate ?? '',
        enableSorting: true,
        cell: ({ row }) => formatDate(row.original.requiredDate),
        meta: { hideBelow: 'md' },
      },
      { id: 'lines', header: 'Lines', accessorFn: (row) => row._count.lines, cell: ({ row }) => row.original._count.lines, meta: { numeric: true, hideBelow: 'sm' } },
      {
        id: 'amount',
        header: 'Estimated',
        accessorFn: (row) => Number(row.estimatedTotal),
        enableSorting: true,
        cell: ({ row }) => formatPHP(row.original.estimatedTotal),
        meta: { numeric: true },
      },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={prStatusKey(row.original.status)} /> },
      {
        id: 'created',
        header: 'Raised',
        accessorFn: (row) => row.createdAt,
        enableSorting: true,
        cell: ({ row }) => formatDate(row.original.createdAt),
        meta: { hideBelow: 'lg' },
      },
    ],
    [],
  );

  const filtering = Boolean(list.debounced) || list.activeCount > 0 || mine || Boolean(scope.projectId);
  return (
    <PermissionGate module="procurement.requisition">
      <PageHeader
        title="Purchase requisitions"
        description="Requests for materials from project teams, from draft through approval to ordering."
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Requests' }]}
        actions={
          canCreate ? (
            <Button asChild variant="primary">
              <Link href="/procurement/requests/new">
                <Plus className="size-3.5" aria-hidden />
                New requisition
              </Link>
            </Button>
          ) : null
        }
      />
      <DataTable
        caption="Purchase requisitions"
        columns={columns}
        data={page?.items ?? []}
        getRowId={(row) => row.id}
        loading={requisitions.isPending}
        error={requisitions.error}
        onRetry={() => void requisitions.refetch()}
        onRowActivate={(row) => router.push(`/procurement/requests/${row.id}`)}
        toolbar={
          <FilterBar
            activeCount={list.activeCount + (mine ? 1 : 0)}
            onReset={() => {
              list.clearFilters();
              setMine(false);
            }}
          >
            <SearchInput value={list.search} onValueChange={list.setSearch} placeholder="Search number or purpose" />
            <ProjectScopeChip scope={scope} />
            <div className="w-44">
              <Select aria-label="Status" value={list.filters.status ?? ''} onChange={(event) => list.setFilter('status', event.target.value)}>
                <option value="">All statuses</option>
                {PR_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status === 'SUBMITTED' ? 'Pending approval' : titleCase(status)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-32">
              <Select aria-label="Priority" value={list.filters.priority ?? ''} onChange={(event) => list.setFilter('priority', event.target.value)}>
                <option value="">Any priority</option>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {titleCase(priority)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="pr-mine" checked={mine} onCheckedChange={setMine} />
              <Label htmlFor="pr-mine">My requests</Label>
            </div>
          </FilterBar>
        }
        pagination={{
          count: page?.items.length ?? 0,
          hasPrevious: list.paging.hasPrevious,
          hasNext: Boolean(page?.nextCursor),
          onPrevious: list.paging.goPrevious,
          onNext: () => list.paging.goNext(page?.nextCursor ?? null),
          loading: requisitions.isFetching,
        }}
        emptyState={
          <EmptyState
            icon={ClipboardList}
            title={filtering ? 'No requisitions match these filters' : 'No requisitions yet'}
            description={
              filtering
                ? 'Clear the filters, or show every project, to see more.'
                : 'Raise a requisition to ask for materials. Approved requests can then go to suppliers as an RFQ.'
            }
            action={
              canCreate && !filtering ? (
                <Button asChild variant="primary">
                  <Link href="/procurement/requests/new">
                    <Plus className="size-3.5" aria-hidden />
                    New requisition
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
