'use client';

import { PRIORITIES, PR_STATUSES } from '@probuild/shared';
import { AlertTriangle, ArrowRight, ClipboardList, Clock, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import type { DataColumn } from '@/components/common/data-table/column-meta';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { FilterBar } from '@/components/common/filter-bar';
import { PageHeader } from '@/components/common/page-header';
import { SearchInput } from '@/components/common/search-input';
import { PriorityBadge } from '@/components/common/priority-badge';
import { StatusBadge } from '@/components/common/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useApprovals } from '@/features/approvals/api/hooks';
import { useCan, useCurrentUser } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { ProjectScopeChip, useProjectScope } from '@/features/context/project-scope';
import type { RequisitionRow } from '@/lib/api/types';
import { formatDate, formatPHP, titleCase } from '@/lib/format';
import { useListState } from '@/lib/list-state';
import { useRequisitions } from '../api/hooks';
import { isRequisitionOverdue, prStatusKey } from '../model';

const INITIAL = { status: '', priority: '' } as Record<string, string>;

/** Requisitions whose current approval step belongs to this user's role, from the approvals inbox. */
function useAwaitingMyApproval(): Set<string> {
  const canApprove = useCan('approvals.inbox', 'VIEW');
  const approvals = useApprovals({ mine: true, limit: 100 }, canApprove);
  return React.useMemo(
    () =>
      new Set(
        (approvals.data?.items ?? [])
          .filter((request) => request.documentType === 'PURCHASE_REQUISITION' && request.status === 'PENDING')
          .map((request) => request.documentId),
      ),
    [approvals.data],
  );
}

function NeededBy({ row }: { row: RequisitionRow }) {
  if (!isRequisitionOverdue(row)) return <span className="text-muted-foreground">{formatDate(row.requiredDate)}</span>;
  return (
    <span className="inline-flex items-center gap-1 font-medium text-danger" title="Past needed-by date and not yet ordered">
      <AlertTriangle className="size-3.5" aria-hidden />
      {formatDate(row.requiredDate)}
      <span className="sr-only">(overdue)</span>
    </span>
  );
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
  const awaitingMe = useAwaitingMyApproval();

  const columns = React.useMemo<DataColumn<RequisitionRow>[]>(
    () => [
      {
        id: 'number',
        header: 'Request',
        enableSorting: true,
        accessorFn: (row) => row.number,
        cell: ({ row }) => (
          <div className="flex flex-col items-start gap-1">
            <Link href={`/procurement/requests/${row.original.id}`} className="doc-link">
              {row.original.number}
            </Link>
            {awaitingMe.has(row.original.id) ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-pending-subtle px-1.5 py-px text-2xs font-semibold text-pending">
                <Clock className="size-3" aria-hidden />
                Your approval
              </span>
            ) : null}
          </div>
        ),
        meta: { sticky: true },
      },
      {
        id: 'purpose',
        header: 'Purpose',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="max-w-80 truncate font-medium">{row.original.purpose ?? <span className="font-normal text-subtle-foreground">No purpose stated</span>}</p>
            <p className="max-w-80 truncate text-xs text-muted-foreground">
              <span className="font-mono">{row.original.project.code}</span> · {row.original.project.name}
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
        cell: ({ row }) => <NeededBy row={row.original} />,
        meta: { hideBelow: 'md' },
      },
      { id: 'lines', header: 'Lines', accessorFn: (row) => row._count.lines, cell: ({ row }) => row.original._count.lines, meta: { numeric: true, hideBelow: 'sm' } },
      {
        id: 'amount',
        header: 'Estimated',
        accessorFn: (row) => Number(row.estimatedTotal),
        enableSorting: true,
        cell: ({ row }) => <span className="font-medium">{formatPHP(row.original.estimatedTotal)}</span>,
        meta: { numeric: true },
      },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={prStatusKey(row.original.status)} /> },
      {
        id: 'created',
        header: 'Raised',
        accessorFn: (row) => row.createdAt,
        enableSorting: true,
        cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
        meta: { hideBelow: 'lg' },
      },
    ],
    [awaitingMe],
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
      {awaitingMe.size > 0 ? (
        <Alert
          tone="warning"
          className="mb-4"
          title={`${awaitingMe.size} ${awaitingMe.size === 1 ? 'requisition is' : 'requisitions are'} waiting on your approval`}
          action={
            <Button asChild size="sm">
              <Link href="/approvals">
                Review in approvals
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </Button>
          }
        >
          They are marked “Your approval” in the list below.
        </Alert>
      ) : null}
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
