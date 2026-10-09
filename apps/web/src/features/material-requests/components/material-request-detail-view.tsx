'use client';

import { newIdempotencyKey } from '@probuild/api-client';
import { Ban, Lock, PackageMinus, Send } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { ActivityPanel } from '@/components/common/activity-panel';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import type { DataColumn } from '@/components/common/data-table/column-meta';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { DetailList, Panel } from '@/components/common/panel';
import { ReasonDialog } from '@/components/common/reason-dialog';
import { StatusBadge } from '@/components/common/status-badge';
import { UrlTabs } from '@/components/common/url-tabs';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { currentApproval, DocumentApprovalPanel } from '@/features/approvals/components/document-approval';
import { getDocumentDecisionRights } from '@/features/approvals/model';
import { useCan, useCurrentUser } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { errorMessage } from '@/lib/api/errors';
import type { MaterialRequestDetail, MaterialRequestLine } from '@/lib/api/types';
import { formatDate, formatDateTime, formatPHP, formatQty } from '@/lib/format';
import {
  useCancelOrCloseMaterialRequest,
  useDecideMaterialRequest,
  useMaterialRequest,
  useMaterialRequestActivity,
  useSubmitMaterialRequest,
} from '../api/hooks';
import { availableMrActions, documentStatusKey } from '../model';

function SummaryStrip({ request }: { request: MaterialRequestDetail }) {
  const items: Array<{ label: string; value: React.ReactNode; numeric?: boolean }> = [
    { label: 'Project', value: <Link href={`/projects/${request.projectId}`} className="hover:underline">{request.project.name}</Link> },
    { label: 'Issue from', value: <Link href={`/inventory/warehouses/${request.warehouseId}`} className="hover:underline">{request.warehouse.name}</Link> },
    { label: 'Requested by', value: request.requester?.name ?? '—' },
    { label: 'Needed by', value: request.neededDate ? formatDate(request.neededDate) : '—' },
    { label: 'Estimated cost', value: formatPHP(request.estimatedTotal), numeric: true },
  ];
  return (
    <dl className="mb-5 grid gap-x-6 gap-y-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className={`mt-0.5 truncate font-medium ${item.numeric ? 'num' : ''}`}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Lines({ request }: { request: MaterialRequestDetail }) {
  const showStock = request.status === 'APPROVED' || request.status === 'SUBMITTED' || request.status === 'DRAFT';
  const columns = React.useMemo<DataColumn<MaterialRequestLine>[]>(
    () => [
      { id: 'no', header: '#', cell: ({ row }) => row.original.lineNo, meta: { sticky: true } },
      {
        id: 'item',
        header: 'Item',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p>
              <Link href={`/inventory/items/${row.original.itemId}`} className="font-medium hover:underline">
                {row.original.item.name}
              </Link>{' '}
              <span className="font-mono text-xs text-muted-foreground">{row.original.item.sku}</span>
            </p>
            {row.original.purpose ? <p className="text-xs text-muted-foreground">{row.original.purpose}</p> : null}
            {row.original.wbsNode || row.original.costCode ? (
              <p className="text-xs text-muted-foreground">{[row.original.wbsNode?.code, row.original.costCode?.code, row.original.boqItem?.itemNo].filter(Boolean).join(' · ')}</p>
            ) : null}
          </div>
        ),
      },
      { id: 'qty', header: 'Requested', cell: ({ row }) => formatQty(row.original.qty, row.original.unit), meta: { numeric: true } },
      { id: 'approved', header: 'Approved', cell: ({ row }) => formatQty(row.original.approvedQty), meta: { numeric: true } },
      { id: 'issued', header: 'Issued', cell: ({ row }) => formatQty(row.original.issuedQty), meta: { numeric: true } },
      {
        id: 'remaining',
        header: 'Left to issue',
        cell: ({ row }) => <span className="font-medium">{formatQty(row.original.remainingQty)}</span>,
        meta: { numeric: true },
      },
      ...(showStock
        ? ([
            {
              id: 'stock',
              header: 'Stock available',
              cell: ({ row }) => formatQty(row.original.stock.available, row.original.item.baseUnit),
              meta: { numeric: true, hideBelow: 'md' },
            },
          ] satisfies DataColumn<MaterialRequestLine>[])
        : []),
    ],
    [showStock],
  );
  return (
    <DataTable
      caption="Material request lines"
      columns={columns}
      data={request.lines}
      getRowId={(line) => line.id}
      loading={false}
      maxHeightClassName="max-h-[60vh]"
      emptyState={<EmptyState compact title="No lines" />}
    />
  );
}

function Issues({ request }: { request: MaterialRequestDetail }) {
  return (
    <Panel title="Material issues" bodyClassName="p-0">
      {request.issues.length === 0 ? (
        <EmptyState
          compact
          icon={PackageMinus}
          title="Nothing issued yet"
          description={request.status === 'APPROVED' ? 'Issues made against this request are listed here.' : 'Material can be issued once the request is approved.'}
        />
      ) : (
        <ul className="divide-y divide-border">
          {request.issues.map((issue) => (
            <li key={issue.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <Link href={`/inventory/material-issues/${issue.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                {issue.number}
              </Link>
              <StatusBadge status={issue.status} />
              <span className="text-muted-foreground">{formatDate(issue.issueDate)}</span>
              <span className="num ml-auto font-medium">{formatPHP(issue.totalCost)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Details({ request }: { request: MaterialRequestDetail }) {
  return (
    <Panel title="Request details">
      <DetailList
        items={[
          { label: 'Purpose', value: request.purpose, wide: true },
          { label: 'Employee', value: request.employee ? `${request.employee.code} · ${request.employee.fullName}` : null },
          { label: 'Submitted', value: request.submittedAt ? formatDateTime(request.submittedAt) : null },
          { label: 'Approved', value: request.approvedAt ? formatDateTime(request.approvedAt) : null },
          { label: 'Rejected', value: request.rejectedAt ? formatDateTime(request.rejectedAt) : null },
          { label: 'Cancelled', value: request.cancelledAt ? `${formatDateTime(request.cancelledAt)}: ${request.cancelReason ?? ''}` : null },
          { label: 'Closed', value: request.closedAt ? `${formatDateTime(request.closedAt)}: ${request.closeReason ?? ''}` : null },
          { label: 'Remarks', value: request.remarks, wide: true },
        ]}
      />
    </Panel>
  );
}

export function MaterialRequestDetailView({ id }: { id: string }) {
  const query = useMaterialRequest(id);
  const request = query.data;
  const me = useCurrentUser();
  const scope = { projectId: request?.projectId, warehouseId: request?.warehouseId };
  const canSubmit = useCan('inventory.request', 'SUBMIT', scope);
  const canCancel = useCan('inventory.request', 'CANCEL', scope);
  const canClose = useCan('inventory.request', 'CLOSE', scope);
  const canIssue = useCan('inventory.issue', 'CREATE', scope);
  const activity = useMaterialRequestActivity(id);
  const submit = useSubmitMaterialRequest(id);
  const decide = useDecideMaterialRequest(id);
  const cancelOrClose = useCancelOrCloseMaterialRequest(id);
  const [confirmSubmit, setConfirmSubmit] = React.useState(false);
  const [reasonFor, setReasonFor] = React.useState<'cancel' | 'close' | null>(null);
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const submitKey = React.useRef<string | null>(null);

  const actions = request ? availableMrActions(request.status, { submit: canSubmit, cancel: canCancel, close: canClose, issue: canIssue }) : null;
  const approval = request ? currentApproval(request.approvals) : undefined;
  const waitingOnMe = request ? getDocumentDecisionRights(approval, me, request.projectId).canApprove : false;

  function doSubmit(): void {
    submitKey.current ??= newIdempotencyKey();
    submit.mutate(submitKey.current, {
      onSuccess: (updated) => {
        submitKey.current = null;
        setConfirmSubmit(false);
        toast.success(updated.status === 'APPROVED' ? 'Approved on submission' : 'Submitted for approval');
      },
      onError: (error) => {
        setConfirmSubmit(false);
        toast.error('Could not submit the request', errorMessage(error));
      },
    });
  }

  return (
    <PermissionGate module="inventory.request">
      {query.isPending ? (
        <div className="space-y-4" role="status" aria-label="Loading material request">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : query.isError || !request || !actions ? (
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <PageHeader
            title={request.number}
            breadcrumbs={[{ label: 'Inventory' }, { label: 'Material requests', href: '/inventory/material-requests' }, { label: request.number }]}
            meta={<StatusBadge status={documentStatusKey(request.status)} />}
            actions={
              <>
                {actions.cancel ? (
                  <Button onClick={() => { setReasonError(null); setReasonFor('cancel'); }}>
                    <Ban className="size-3.5" aria-hidden />
                    Cancel
                  </Button>
                ) : null}
                {actions.close ? (
                  <Button onClick={() => { setReasonError(null); setReasonFor('close'); }}>
                    <Lock className="size-3.5" aria-hidden />
                    Close
                  </Button>
                ) : null}
                {actions.submit ? (
                  <Button variant="primary" onClick={() => setConfirmSubmit(true)}>
                    <Send className="size-3.5" aria-hidden />
                    Submit for approval
                  </Button>
                ) : null}
                {actions.issue ? (
                  <Button asChild variant="primary">
                    <Link href={`/inventory/material-issues/new?requestId=${request.id}`}>
                      <PackageMinus className="size-3.5" aria-hidden />
                      Issue material
                    </Link>
                  </Button>
                ) : null}
              </>
            }
          />
          {waitingOnMe ? (
            <Alert
              tone="info"
              title="Waiting on your approval"
              className="mb-4"
              action={
                <Button asChild size="sm" variant="primary">
                  <Link href={`/inventory/material-requests/${id}?tab=approvals`}>Review</Link>
                </Button>
              }
            >
              Your role holds the current approval step for this request.
            </Alert>
          ) : null}
          <SummaryStrip request={request} />
          <UrlTabs
            label="Material request sections"
            tabs={[
              { id: 'lines', label: 'Lines', count: request.lines.length, content: <Lines request={request} /> },
              {
                id: 'approvals',
                label: 'Approvals',
                content: (
                  <Panel>
                    <DocumentApprovalPanel
                      approvals={request.approvals}
                      projectId={request.projectId}
                      emptyHint={request.status === 'DRAFT' ? 'Submit the request to start its approval route.' : 'This request has no approval request.'}
                      onDecide={(input) => decide.mutateAsync(input)}
                    />
                  </Panel>
                ),
              },
              { id: 'issues', label: 'Issues', count: request.issues.length, content: <Issues request={request} /> },
              { id: 'details', label: 'Details', content: <Details request={request} /> },
              {
                id: 'activity',
                label: 'Activity',
                content: (
                  <Panel>
                    <ActivityPanel items={activity.data} loading={activity.isPending} error={activity.error} onRetry={() => void activity.refetch()} />
                  </Panel>
                ),
              },
            ]}
          />
          <ConfirmDialog
            open={confirmSubmit}
            onOpenChange={(open) => (open ? undefined : setConfirmSubmit(false))}
            title={`Submit ${request.number}?`}
            description={`The request for ${request.project.name}, about ${formatPHP(request.estimatedTotal)}, goes to its approvers and can no longer be edited.`}
            confirmLabel="Submit for approval"
            loading={submit.isPending}
            onConfirm={doSubmit}
          />
          <ReasonDialog
            open={reasonFor !== null}
            onOpenChange={(open) => (open ? undefined : setReasonFor(null))}
            title={reasonFor === 'cancel' ? `Cancel ${request.number}?` : `Close ${request.number}?`}
            description={
              reasonFor === 'cancel'
                ? 'The request is withdrawn and its reserved stock is released. This is not possible once material has been issued against it.'
                : 'No further material can be issued against this request. Quantities already issued stay on the project.'
            }
            confirmLabel={reasonFor === 'cancel' ? 'Cancel request' : 'Close request'}
            tone="danger"
            loading={cancelOrClose.isPending}
            error={reasonError}
            onConfirm={(reason) => {
              if (!reasonFor) return;
              setReasonError(null);
              cancelOrClose.mutate(
                { action: reasonFor, reason },
                {
                  onSuccess: () => {
                    toast.success(reasonFor === 'cancel' ? 'Material request cancelled' : 'Material request closed');
                    setReasonFor(null);
                  },
                  onError: (error) => setReasonError(errorMessage(error)),
                },
              );
            }}
          />
        </>
      )}
    </PermissionGate>
  );
}
