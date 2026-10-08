'use client';

import { newIdempotencyKey } from '@probuild/api-client';
import { Ban, Copy, FilePlus2, Lock, Pencil, Send } from 'lucide-react';
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
import {
  currentApproval,
  DocumentApprovalPanel,
} from '@/features/approvals/components/document-approval';
import { getDocumentDecisionRights } from '@/features/approvals/model';
import { useCan, useCurrentUser } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { errorMessage } from '@/lib/api/errors';
import type { RequisitionDetail, RequisitionLine } from '@/lib/api/types';
import { formatDate, formatPHP, formatQty } from '@/lib/format';
import {
  useCloseOrCancelRequisition,
  useDecideRequisition,
  useRequisition,
  useRequisitionActivity,
  useSubmitRequisition,
} from '../api/hooks';
import { prStatusKey } from '../model';
import { PriorityBadge } from './requisitions-view';

const CANCELLABLE = ['DRAFT', 'SUBMITTED', 'APPROVED'];
const CLOSABLE = ['APPROVED', 'PARTIALLY_ORDERED', 'ORDERED'];
const SOURCEABLE = ['APPROVED', 'PARTIALLY_ORDERED'];
const COPYABLE = ['REJECTED', 'CANCELLED', 'CLOSED'];

function Overview({ pr }: { pr: RequisitionDetail }) {
  const totalQty = pr.lines.length;
  const ordered = pr.lines.filter((line) => Number(line.remainingQty) <= 0).length;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Request">
        <DetailList
          columns={2}
          items={[
            { label: 'Project', value: <Link href={`/projects/${pr.projectId}`} className="text-primary hover:underline">{pr.project.code} · {pr.project.name}</Link> },
            { label: 'Requester', value: pr.requester?.name },
            { label: 'Priority', value: <PriorityBadge priority={pr.priority} /> },
            { label: 'Needed by', value: formatDate(pr.requiredDate) },
            { label: 'Purpose', value: pr.purpose, wide: true },
            { label: 'Remarks', value: pr.remarks, wide: true },
          ]}
        />
      </Panel>
      <Panel title="Progress">
        <DetailList
          columns={2}
          items={[
            { label: 'Estimated amount', value: formatPHP(pr.estimatedTotal), numeric: true },
            { label: 'Lines fully ordered', value: `${ordered} of ${totalQty}`, numeric: true },
            { label: 'Raised', value: formatDate(pr.createdAt) },
            { label: 'Submitted', value: formatDate(pr.submittedAt) },
            ...(pr.approvedAt ? [{ label: 'Approved', value: formatDate(pr.approvedAt) }] : []),
            ...(pr.rejectedAt ? [{ label: 'Rejected', value: formatDate(pr.rejectedAt) }] : []),
            ...(pr.cancelledAt ? [{ label: 'Cancelled', value: `${formatDate(pr.cancelledAt)} · ${pr.cancelReason ?? ''}`, wide: true }] : []),
            ...(pr.closedAt ? [{ label: 'Closed', value: `${formatDate(pr.closedAt)} · ${pr.closeReason ?? ''}`, wide: true }] : []),
          ]}
        />
      </Panel>
    </div>
  );
}

function Lines({ pr }: { pr: RequisitionDetail }) {
  const columns = React.useMemo<DataColumn<RequisitionLine>[]>(
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
            {row.original.description && row.original.description !== row.original.item.name ? <p className="text-xs text-muted-foreground">{row.original.description}</p> : null}
            {row.original.justification ? <p className="text-xs italic text-muted-foreground">{row.original.justification}</p> : null}
          </div>
        ),
      },
      { id: 'qty', header: 'Requested', cell: ({ row }) => formatQty(row.original.qty, row.original.unit), meta: { numeric: true } },
      { id: 'ordered', header: 'Ordered', cell: ({ row }) => formatQty(row.original.orderedQty), meta: { numeric: true, hideBelow: 'sm' } },
      { id: 'remaining', header: 'Remaining', cell: ({ row }) => formatQty(row.original.remainingQty), meta: { numeric: true } },
      { id: 'needed', header: 'Needed by', cell: ({ row }) => formatDate(row.original.requiredDate), meta: { hideBelow: 'md' } },
      {
        id: 'coding',
        header: 'WBS / cost code',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {[row.original.wbsNode?.code, row.original.costCode?.code, row.original.boqItem?.itemNo].filter(Boolean).join(' · ') || '—'}
          </span>
        ),
        meta: { hideBelow: 'lg' },
      },
      { id: 'unitCost', header: 'Est. unit cost', cell: ({ row }) => formatPHP(row.original.estimatedUnitCost), meta: { numeric: true, hideBelow: 'md' } },
      { id: 'amount', header: 'Amount', cell: ({ row }) => <span className="font-medium">{formatPHP(row.original.estimatedAmount)}</span>, meta: { numeric: true } },
    ],
    [],
  );
  return (
    <div className="space-y-2">
      <DataTable caption="Requisition lines" columns={columns} data={pr.lines} getRowId={(line) => line.id} loading={false} emptyState={<EmptyState compact title="No lines" />} maxHeightClassName="max-h-[60vh]" />
      <p className="num text-right text-sm">
        <span className="text-muted-foreground">Estimated total </span>
        <span className="font-semibold">{formatPHP(pr.estimatedTotal)}</span>
      </p>
    </div>
  );
}

function Sourcing({ pr, canCreateRfq }: { pr: RequisitionDetail; canCreateRfq: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="Requests for quotation"
        bodyClassName="p-0"
        actions={
          canCreateRfq && SOURCEABLE.includes(pr.status) ? (
            <Button asChild size="sm" variant="primary">
              <Link href={`/procurement/rfqs/new?requisitionId=${pr.id}`}>
                <FilePlus2 className="size-3.5" aria-hidden />
                Create RFQ
              </Link>
            </Button>
          ) : null
        }
      >
        {pr.rfqs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {SOURCEABLE.includes(pr.status)
              ? 'No RFQ yet. Create one to invite suppliers to quote the open lines.'
              : 'RFQs can be raised once the requisition is approved.'}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {pr.rfqs.map((rfq) => (
              <li key={rfq.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Link href={`/procurement/rfqs/${rfq.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                  {rfq.number}
                </Link>
                <StatusBadge status={rfq.status} />
                <span className="ml-auto text-xs text-muted-foreground">{rfq.dueDate ? `Quotes due ${formatDate(rfq.dueDate)}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Purchase orders" bodyClassName="p-0">
        {pr.purchaseOrders.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No purchase orders raised against this requisition yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {pr.purchaseOrders.map((po) => (
              <li key={po.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Link href={`/procurement/orders/${po.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                  {po.number}
                </Link>
                <StatusBadge status={po.status} />
                <span className="truncate text-muted-foreground">{po.supplier.name}</span>
                <span className="num ml-auto">{formatPHP(po.totalAmount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function RequisitionDetailView({ id }: { id: string }) {
  const requisition = useRequisition(id);
  const me = useCurrentUser();
  const pr = requisition.data;
  const scope = { projectId: pr?.projectId };
  const canEdit = useCan('procurement.requisition', 'EDIT', scope);
  const canSubmit = useCan('procurement.requisition', 'SUBMIT', scope);
  const canCancel = useCan('procurement.requisition', 'CANCEL', scope);
  const canClose = useCan('procurement.requisition', 'CLOSE', scope);
  const canCreate = useCan('procurement.requisition', 'CREATE', scope);
  const canCreateRfq = useCan('procurement.rfq', 'CREATE', scope);
  const activity = useRequisitionActivity(id);
  const submit = useSubmitRequisition(id);
  const decide = useDecideRequisition(id);
  const closeOrCancel = useCloseOrCancelRequisition(id);
  const [confirmSubmit, setConfirmSubmit] = React.useState(false);
  const [reasonFor, setReasonFor] = React.useState<'cancel' | 'close' | null>(null);
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const submitKey = React.useRef<string | null>(null);

  function doSubmit(): void {
    submitKey.current ??= newIdempotencyKey();
    submit.mutate(submitKey.current, {
      onSuccess: (updated) => {
        submitKey.current = null;
        setConfirmSubmit(false);
        toast.success(
          updated.status === 'APPROVED' ? 'Approved on submission' : 'Submitted for approval',
          updated.status === 'APPROVED' ? 'No approval step applies to this amount.' : undefined,
        );
      },
      onError: (error) => {
        setConfirmSubmit(false);
        toast.error('Could not submit the requisition', errorMessage(error));
      },
    });
  }

  function doReason(reason: string): void {
    if (!reasonFor) return;
    setReasonError(null);
    closeOrCancel.mutate(
      { action: reasonFor, reason },
      {
        onSuccess: () => {
          toast.success(reasonFor === 'cancel' ? 'Requisition cancelled' : 'Requisition closed');
          setReasonFor(null);
        },
        onError: (error) => setReasonError(errorMessage(error)),
      },
    );
  }

  const approval = pr ? currentApproval(pr.approvals) : undefined;
  const waitingOnMe = pr ? getDocumentDecisionRights(approval, me, pr.projectId).canApprove : false;

  return (
    <PermissionGate module="procurement.requisition">
      {requisition.isPending ? (
        <div className="space-y-4" role="status" aria-label="Loading requisition">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : requisition.isError || !pr ? (
        <QueryErrorState error={requisition.error} onRetry={() => void requisition.refetch()} />
      ) : (
        <>
          <PageHeader
            title={pr.number}
            description={pr.purpose ?? undefined}
            breadcrumbs={[{ label: 'Procurement' }, { label: 'Requests', href: '/procurement/requests' }, { label: pr.number }]}
            meta={
              <>
                <StatusBadge status={prStatusKey(pr.status)} />
                <PriorityBadge priority={pr.priority} />
              </>
            }
            actions={
              <>
                {pr.status === 'DRAFT' && canEdit ? (
                  <Button asChild>
                    <Link href={`/procurement/requests/${id}/edit`}>
                      <Pencil className="size-3.5" aria-hidden />
                      Edit
                    </Link>
                  </Button>
                ) : null}
                {COPYABLE.includes(pr.status) && canCreate ? (
                  <Button asChild>
                    <Link href={`/procurement/requests/new?from=${id}`}>
                      <Copy className="size-3.5" aria-hidden />
                      Copy to new
                    </Link>
                  </Button>
                ) : null}
                {CANCELLABLE.includes(pr.status) && canCancel ? (
                  <Button onClick={() => setReasonFor('cancel')}>
                    <Ban className="size-3.5" aria-hidden />
                    Cancel
                  </Button>
                ) : null}
                {CLOSABLE.includes(pr.status) && canClose ? (
                  <Button onClick={() => setReasonFor('close')}>
                    <Lock className="size-3.5" aria-hidden />
                    Close
                  </Button>
                ) : null}
                {pr.status === 'DRAFT' && canSubmit ? (
                  <Button variant="primary" onClick={() => setConfirmSubmit(true)}>
                    <Send className="size-3.5" aria-hidden />
                    Submit for approval
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
                  <Link href={`/procurement/requests/${id}?tab=approvals`}>Review</Link>
                </Button>
              }
            >
              Your role holds the current approval step for this requisition.
            </Alert>
          ) : null}
          <UrlTabs
            label="Requisition sections"
            tabs={[
              { id: 'overview', label: 'Overview', content: <Overview pr={pr} /> },
              { id: 'lines', label: 'Lines', count: pr.lines.length, content: <Lines pr={pr} /> },
              {
                id: 'approvals',
                label: 'Approvals',
                content: (
                  <Panel>
                    <DocumentApprovalPanel
                      approvals={pr.approvals}
                      projectId={pr.projectId}
                      emptyHint={pr.status === 'DRAFT' ? 'Submit the requisition to start its approval route.' : 'This requisition has no approval request.'}
                      onDecide={(input) => decide.mutateAsync(input)}
                    />
                  </Panel>
                ),
              },
              { id: 'sourcing', label: 'RFQs and orders', count: pr.rfqs.length + pr.purchaseOrders.length, content: <Sourcing pr={pr} canCreateRfq={canCreateRfq} /> },
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
            onOpenChange={setConfirmSubmit}
            title={`Submit ${pr.number}?`}
            description={`The requisition (${pr.lines.length} lines, estimated ${formatPHP(pr.estimatedTotal)}) goes to its approvers and can no longer be edited.`}
            confirmLabel="Submit for approval"
            loading={submit.isPending}
            onConfirm={doSubmit}
          />
          <ReasonDialog
            open={reasonFor !== null}
            onOpenChange={(open) => (open ? undefined : setReasonFor(null))}
            title={reasonFor === 'cancel' ? `Cancel ${pr.number}?` : `Close ${pr.number}?`}
            description={
              reasonFor === 'cancel'
                ? 'The requisition is withdrawn and any pending approval is cancelled. It cannot be reopened.'
                : 'No further RFQs or orders can be raised from this requisition. Quantities already ordered are unaffected.'
            }
            confirmLabel={reasonFor === 'cancel' ? 'Cancel requisition' : 'Close requisition'}
            tone="danger"
            loading={closeOrCancel.isPending}
            error={reasonError}
            onConfirm={doReason}
          />
        </>
      )}
    </PermissionGate>
  );
}
