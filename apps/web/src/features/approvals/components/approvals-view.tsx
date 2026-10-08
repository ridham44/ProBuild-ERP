'use client';

import type { DataColumn } from '@/components/common/data-table/column-meta';
import { ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { FilterBar } from '@/components/common/filter-bar';
import { PageHeader } from '@/components/common/page-header';
import { useCursorPagination } from '@/components/common/pagination';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { APPROVAL_DOCUMENT_TYPES, type ApprovalDocumentType } from '@probuild/shared';
import type { ApprovalFilters, ApprovalRequestDto, ApprovalStatusKey } from '@/lib/api/types';
import { formatPHP, formatRelative } from '@/lib/format';
import { useApprovals } from '../api/hooks';
import { documentHref, documentTypeLabel } from '../model';
import { ApprovalDetailDrawer } from './approval-detail-drawer';

const PAGE_SIZE = 25;
const STATUS_OPTIONS: ReadonlyArray<{ value: ApprovalStatusKey | 'ALL'; label: string }> = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'ALL', label: 'All statuses' },
];

export function ApprovalsView() {
  const [status, setStatus] = React.useState<ApprovalStatusKey | 'ALL'>('PENDING');
  const [mine, setMine] = React.useState(true);
  const [documentType, setDocumentType] = React.useState<ApprovalDocumentType | ''>('');
  const paging = useCursorPagination();
  const { reset } = paging;
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const filters: ApprovalFilters = {
    limit: PAGE_SIZE,
    ...(mine ? { mine: true } : status === 'ALL' ? {} : { status }),
    ...(documentType ? { documentType } : {}),
    ...(paging.cursor ? { cursor: paging.cursor } : {}),
  };
  const approvals = useApprovals(filters);
  const page = approvals.data;
  const selected = page?.items.find((request) => request.id === selectedId) ?? null;
  const activeFilters =
    (mine ? 0 : 1) + (documentType ? 1 : 0) + (!mine && status !== 'PENDING' ? 1 : 0);

  React.useEffect(() => reset(), [status, mine, documentType, reset]);

  const columns = React.useMemo<DataColumn<ApprovalRequestDto>[]>(
    () => [
      {
        id: 'document',
        header: 'Document',
        meta: { sticky: true },
        cell: ({ row }) => (
          <div>
            {documentHref(row.original.documentType, row.original.documentId) ? (
              <Link
                href={documentHref(row.original.documentType, row.original.documentId) ?? '#'}
                className="font-mono text-xs font-medium text-primary hover:underline"
              >
                {row.original.documentNo ?? 'Open'}
              </Link>
            ) : (
              <p className="font-mono text-xs font-medium">{row.original.documentNo ?? '—'}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {documentTypeLabel(row.original.documentType)}
            </p>
          </div>
        ),
      },
      {
        id: 'amount',
        header: 'Amount',
        accessorFn: (request) => Number(request.amount),
        enableSorting: true,
        cell: ({ row }) => formatPHP(row.original.amount),
        meta: { numeric: true },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'step',
        header: 'Waiting on',
        cell: ({ row }) =>
          row.original.status === 'PENDING' ? (
            <span>
              <span className="num">
                {row.original.currentStep} of {row.original.totalSteps}
              </span>
              <span className="text-muted-foreground"> · {row.original.currentRole ?? '—'}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        meta: { hideBelow: 'md' },
      },
      {
        id: 'requestedBy',
        header: 'Requested by',
        cell: ({ row }) => row.original.requestedBy.name,
        meta: { hideBelow: 'sm' },
      },
      {
        id: 'requested',
        header: 'Requested',
        accessorFn: (request) => request.createdAt,
        enableSorting: true,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{formatRelative(row.original.createdAt)}</span>
        ),
        meta: { hideBelow: 'lg' },
      },
      {
        id: 'open',
        header: () => <span className="sr-only">Open</span>,
        enableHiding: false,
        meta: { numeric: true },
        cell: ({ row }) => (
          <Button size="sm" onClick={() => setSelectedId(row.original.id)}>
            Review
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <PermissionGate module="approvals.inbox">
      <PageHeader
        title="Approvals"
        description="Requests that need a decision, and the history of those already decided."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Approvals' }]}
      />
      <DataTable
        toolbar={
          <FilterBar
            activeCount={activeFilters}
            onReset={() => {
              setMine(true);
              setStatus('PENDING');
              setDocumentType('');
            }}
          >
            <div className="flex items-center gap-2">
              <Switch id="approvals-mine" checked={mine} onCheckedChange={setMine} />
              <Label htmlFor="approvals-mine">Waiting on my role</Label>
            </div>
            <div className="w-40">
              <Select
                aria-label="Status"
                value={mine ? 'PENDING' : status}
                disabled={mine}
                onChange={(event) => setStatus(event.target.value as ApprovalStatusKey | 'ALL')}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-52">
              <Select
                aria-label="Document type"
                value={documentType}
                onChange={(event) =>
                  setDocumentType(event.target.value as ApprovalDocumentType | '')
                }
              >
                <option value="">All document types</option>
                {APPROVAL_DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {documentTypeLabel(type)}
                  </option>
                ))}
              </Select>
            </div>
          </FilterBar>
        }
        caption="Approval requests"
        columns={columns}
        data={page?.items ?? []}
        getRowId={(request) => request.id}
        loading={approvals.isPending}
        error={approvals.error}
        onRetry={() => void approvals.refetch()}
        onRowActivate={(request) => setSelectedId(request.id)}
        pagination={{
          count: page?.items.length ?? 0,
          hasPrevious: paging.hasPrevious,
          hasNext: Boolean(page?.nextCursor),
          onPrevious: paging.goPrevious,
          onNext: () => paging.goNext(page?.nextCursor ?? null),
          loading: approvals.isFetching,
        }}
        emptyState={
          <EmptyState
            icon={ClipboardCheck}
            title={mine ? 'Nothing is waiting on you' : 'No approval requests match these filters'}
            description={
              mine
                ? 'When a purchase request, order or payment reaches a step assigned to your role it appears here, and you are notified.'
                : 'Documents appear here once they are submitted for approval under a configured workflow.'
            }
          />
        }
      />
      <ApprovalDetailDrawer request={selected} onClose={() => setSelectedId(null)} />
    </PermissionGate>
  );
}
