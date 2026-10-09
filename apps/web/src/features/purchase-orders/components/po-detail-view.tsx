'use client';

import { newIdempotencyKey } from '@probuild/api-client';
import { Ban, Download, Lock, Pencil, PackageCheck, Printer, Send, Truck } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { ActivityPanel } from '@/components/common/activity-panel';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import type { DataColumn } from '@/components/common/data-table/column-meta';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { DetailPageSkeleton } from '@/components/common/page-skeleton';
import { PageHeader } from '@/components/common/page-header';
import { SummaryStrip, type SummaryFact } from '@/components/common/summary-strip';
import { Panel } from '@/components/common/panel';
import { ReasonDialog } from '@/components/common/reason-dialog';
import { StatusBadge } from '@/components/common/status-badge';
import { UrlTabs } from '@/components/common/url-tabs';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { currentApproval, DocumentApprovalPanel } from '@/features/approvals/components/document-approval';
import { getDocumentDecisionRights } from '@/features/approvals/model';
import { useCan, useCurrentUser } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { useCompany } from '@/features/company/api/hooks';
import { errorMessage } from '@/lib/api/errors';
import { downloadCsv } from '@/lib/csv';
import type { PurchaseOrderDetail, PurchaseOrderLine } from '@/lib/api/types';
import { formatDate, formatDateTime, formatPHP, formatQty } from '@/lib/format';
import {
  useCloseOrCancelPurchaseOrder,
  useDecidePurchaseOrder,
  usePurchaseOrder,
  usePurchaseOrderActivity,
  useSendPurchaseOrder,
  useSubmitPurchaseOrder,
} from '../api/hooks';
import { availablePoActions, lineProgress, purchaseOrderCsv } from '../model';
import { PoDocument } from './po-document';

function KeyFacts({ po }: { po: PurchaseOrderDetail }) {
  const items: SummaryFact[] = [
    { label: 'Supplier', value: <Link href={`/procurement/suppliers/${po.supplierId}`} className="hover:underline">{po.supplier.name}</Link> },
    { label: 'Project', value: <Link href={`/projects/${po.projectId}`} className="hover:underline">{po.project.name}</Link> },
    { label: 'Warehouse', value: po.warehouse.name },
    { label: 'Order date', value: formatDate(po.orderDate) },
    { label: 'Expected delivery', value: po.expectedDate ? formatDate(po.expectedDate) : '—' },
    { label: 'Total', value: formatPHP(po.totalAmount), numeric: true, emphasis: true },
  ];
  return <SummaryStrip facts={items} className="print:hidden" />;
}

function Items({ po }: { po: PurchaseOrderDetail }) {
  const columns = React.useMemo<DataColumn<PurchaseOrderLine>[]>(
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
            {row.original.wbsNode || row.original.costCode ? (
              <p className="text-xs text-muted-foreground">
                {[row.original.wbsNode?.code, row.original.costCode?.code, row.original.boqItem?.itemNo].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
        ),
      },
      { id: 'ordered', header: 'Ordered', cell: ({ row }) => formatQty(row.original.qty, row.original.unit), meta: { numeric: true } },
      { id: 'received', header: 'Received', cell: ({ row }) => formatQty(row.original.receivedQty), meta: { numeric: true } },
      {
        id: 'cancelled',
        header: 'Cancelled',
        cell: ({ row }) => (Number(row.original.cancelledQty) > 0 ? formatQty(row.original.cancelledQty) : '—'),
        meta: { numeric: true },
      },
      {
        id: 'open',
        header: 'Open',
        cell: ({ row }) => {
          const progress = lineProgress(row.original);
          return progress.fullyReceived ? (
            <span className="text-approved">Complete</span>
          ) : (
            <span className="font-medium">{formatQty(row.original.openQty)}</span>
          );
        },
        meta: { numeric: true },
      },
      { id: 'price', header: 'Unit price', cell: ({ row }) => formatPHP(row.original.unitPrice), meta: { numeric: true, hideBelow: 'md' } },
      { id: 'tax', header: 'VAT', cell: ({ row }) => formatPHP(row.original.taxAmount), meta: { numeric: true, hideBelow: 'lg' } },
      { id: 'total', header: 'Line total', cell: ({ row }) => <span className="font-medium">{formatPHP(row.original.lineTotal)}</span>, meta: { numeric: true } },
    ],
    [],
  );
  return (
    <DataTable
      caption="Purchase order items"
      columns={columns}
      data={po.lines}
      getRowId={(line) => line.id}
      loading={false}
      maxHeightClassName="max-h-[60vh]"
      emptyState={<EmptyState compact title="No lines" />}
    />
  );
}

function Receipts({ po }: { po: PurchaseOrderDetail }) {
  const canReceive = useCan('procurement.receipt', 'CREATE', { projectId: po.projectId, warehouseId: po.warehouseId });
  const receivable = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(po.status);
  return (
    <Panel
      title="Goods receipts"
      bodyClassName="p-0"
      actions={
        canReceive && receivable ? (
          <Button asChild size="sm" variant="primary">
            <Link href={`/inventory/receipts/new?orderId=${po.id}`}>Receive goods</Link>
          </Button>
        ) : undefined
      }
    >
      {po.receipts.length === 0 ? (
        <EmptyState
          compact
          icon={PackageCheck}
          title="Nothing received yet"
          description={
            ['SENT', 'PARTIALLY_RECEIVED'].includes(po.status)
              ? 'Goods receipts against this order are listed here once the warehouse records them.'
              : 'Receipts can be recorded once the order has been approved and sent to the supplier.'
          }
        />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Receipt</th>
              <th className="px-2 py-2 font-medium">Received</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Posted</th>
            </tr>
          </thead>
          <tbody>
            {po.receipts.map((receipt) => (
              <tr key={receipt.id} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-xs font-medium">
                  <Link href={`/inventory/receipts/${receipt.id}`} className="text-primary hover:underline">
                    {receipt.number}
                  </Link>
                </td>
                <td className="px-2 py-2">{formatDate(receipt.receiptDate)}</td>
                <td className="px-2 py-2">
                  <StatusBadge status={receipt.status} />
                </td>
                <td className="px-4 py-2 text-muted-foreground">{receipt.postedAt ? formatDateTime(receipt.postedAt) : 'Not posted'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

export function PoDetailView({ id }: { id: string }) {
  const query = usePurchaseOrder(id);
  const po = query.data;
  const me = useCurrentUser();
  const scope = { projectId: po?.projectId };
  const canEdit = useCan('procurement.order', 'EDIT', scope);
  const canSubmit = useCan('procurement.order', 'SUBMIT', scope);
  const canSend = useCan('procurement.order', 'POST', scope);
  const canCancel = useCan('procurement.order', 'CANCEL', scope);
  const canClose = useCan('procurement.order', 'CLOSE', scope);
  const canPrint = useCan('procurement.order', 'PRINT', scope);
  const canExport = useCan('procurement.order', 'EXPORT', scope);
  const canSeeCompany = useCan('organization.company', 'VIEW');
  const company = useCompany(canSeeCompany);
  const activity = usePurchaseOrderActivity(id);
  const submit = useSubmitPurchaseOrder(id);
  const send = useSendPurchaseOrder(id);
  const decide = useDecidePurchaseOrder(id);
  const closeOrCancel = useCloseOrCancelPurchaseOrder(id);
  const [confirm, setConfirm] = React.useState<'submit' | 'send' | null>(null);
  const [reasonFor, setReasonFor] = React.useState<'cancel' | 'close' | null>(null);
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const submitKey = React.useRef<string | null>(null);

  const actions = po
    ? availablePoActions(po.status, { edit: canEdit, submit: canSubmit, send: canSend, cancel: canCancel, close: canClose })
    : null;
  const approval = po ? currentApproval(po.approvals) : undefined;
  const waitingOnMe = po ? getDocumentDecisionRights(approval, me, po.projectId).canApprove : false;

  function doSubmit(): void {
    submitKey.current ??= newIdempotencyKey();
    submit.mutate(submitKey.current, {
      onSuccess: (updated) => {
        submitKey.current = null;
        setConfirm(null);
        toast.success(updated.status === 'APPROVED' ? 'Approved on submission' : 'Submitted for approval');
      },
      onError: (error) => {
        setConfirm(null);
        toast.error('Could not submit the purchase order', errorMessage(error));
      },
    });
  }

  function doSend(): void {
    send.mutate(undefined, {
      onSuccess: () => {
        setConfirm(null);
        toast.success('Marked as sent to the supplier');
      },
      onError: (error) => {
        setConfirm(null);
        toast.error('Could not send the purchase order', errorMessage(error));
      },
    });
  }

  return (
    <PermissionGate module="procurement.order">
      {query.isPending ? (
        <DetailPageSkeleton label="Loading purchase order" />
      ) : query.isError || !po || !actions ? (
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <div className="print:hidden">
            <PageHeader
              title={po.number}
              breadcrumbs={[{ label: 'Procurement' }, { label: 'Purchase orders', href: '/procurement/orders' }, { label: po.number }]}
              meta={<StatusBadge status={po.status} />}
              actions={
                <>
                  {canPrint ? (
                    <Button onClick={() => window.print()}>
                      <Printer className="size-3.5" aria-hidden />
                      Print
                    </Button>
                  ) : null}
                  {canExport ? (
                    <Button onClick={() => downloadCsv(`${po.number}.csv`, purchaseOrderCsv(po))}>
                      <Download className="size-3.5" aria-hidden />
                      Export CSV
                    </Button>
                  ) : null}
                  {actions.edit ? (
                    <Button asChild>
                      <Link href={`/procurement/orders/${id}/edit`}>
                        <Pencil className="size-3.5" aria-hidden />
                        Edit
                      </Link>
                    </Button>
                  ) : null}
                  {actions.cancel ? (
                    <Button onClick={() => setReasonFor('cancel')}>
                      <Ban className="size-3.5" aria-hidden />
                      Cancel
                    </Button>
                  ) : null}
                  {actions.close ? (
                    <Button onClick={() => setReasonFor('close')}>
                      <Lock className="size-3.5" aria-hidden />
                      Close
                    </Button>
                  ) : null}
                  {actions.submit ? (
                    <Button variant="primary" onClick={() => setConfirm('submit')}>
                      <Send className="size-3.5" aria-hidden />
                      Submit for approval
                    </Button>
                  ) : null}
                  {actions.send ? (
                    <Button variant="primary" onClick={() => setConfirm('send')}>
                      <Truck className="size-3.5" aria-hidden />
                      Mark as sent
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
                    <Link href={`/procurement/orders/${id}?tab=approvals`}>Review</Link>
                  </Button>
                }
              >
                Your role holds the current approval step for this purchase order.
              </Alert>
            ) : null}
            <KeyFacts po={po} />
            <UrlTabs
              label="Purchase order sections"
              tabs={[
                { id: 'overview', label: 'Overview', content: <PoDocument po={po} company={company.data} /> },
                { id: 'items', label: 'Items', count: po.lines.length, content: <Items po={po} /> },
                {
                  id: 'approvals',
                  label: 'Approvals',
                  content: (
                    <Panel>
                      <DocumentApprovalPanel
                        approvals={po.approvals}
                        projectId={po.projectId}
                        emptyHint={po.status === 'DRAFT' ? 'Submit the purchase order to start its approval route.' : 'This purchase order has no approval request.'}
                        onDecide={(input) => decide.mutateAsync(input)}
                      />
                    </Panel>
                  ),
                },
                { id: 'receipts', label: 'Receipts', count: po.receipts.length, content: <Receipts po={po} /> },
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
          </div>
          <div className="hidden print:block">
            <PoDocument po={po} company={company.data} linkParties={false} />
          </div>
          <ConfirmDialog
            open={confirm === 'submit'}
            onOpenChange={(open) => (open ? undefined : setConfirm(null))}
            title={`Submit ${po.number}?`}
            description={`The purchase order for ${po.supplier.name}, ${formatPHP(po.totalAmount)}, goes to its approvers and can no longer be edited.`}
            confirmLabel="Submit for approval"
            loading={submit.isPending}
            onConfirm={doSubmit}
          />
          <ConfirmDialog
            open={confirm === 'send'}
            onOpenChange={(open) => (open ? undefined : setConfirm(null))}
            title={`Mark ${po.number} as sent?`}
            description={`Record that the order has been issued to ${po.supplier.name}. Goods can be received against it afterwards.`}
            confirmLabel="Mark as sent"
            loading={send.isPending}
            onConfirm={doSend}
          />
          <ReasonDialog
            open={reasonFor !== null}
            onOpenChange={(open) => (open ? undefined : setReasonFor(null))}
            title={reasonFor === 'cancel' ? `Cancel ${po.number}?` : `Close ${po.number}?`}
            description={
              reasonFor === 'cancel'
                ? 'The order is withdrawn and its quantities are released back to the requisition.'
                : 'Anything not yet delivered is cancelled and its quantity is released back to the requisition.'
            }
            confirmLabel={reasonFor === 'cancel' ? 'Cancel order' : 'Close order'}
            tone="danger"
            loading={closeOrCancel.isPending}
            error={reasonError}
            onConfirm={(reason) => {
              if (!reasonFor) return;
              setReasonError(null);
              closeOrCancel.mutate(
                { action: reasonFor, reason },
                {
                  onSuccess: () => {
                    toast.success(reasonFor === 'cancel' ? 'Purchase order cancelled' : 'Purchase order closed');
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
