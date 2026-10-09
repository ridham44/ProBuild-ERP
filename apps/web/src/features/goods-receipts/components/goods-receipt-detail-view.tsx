'use client';

import { newIdempotencyKey } from '@probuild/api-client';
import { Ban, ClipboardCheck, PackageCheck } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { ActivityPanel } from '@/components/common/activity-panel';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import type { DataColumn } from '@/components/common/data-table/column-meta';
import { DataTable } from '@/components/common/data-table/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { DetailPageSkeleton } from '@/components/common/page-skeleton';
import { StackedBar } from '@/components/common/meter';
import { PageHeader } from '@/components/common/page-header';
import { SummaryStrip, type SummaryFact } from '@/components/common/summary-strip';
import { DetailList, Panel } from '@/components/common/panel';
import { ReasonDialog } from '@/components/common/reason-dialog';
import { StatusBadge } from '@/components/common/status-badge';
import { UrlTabs } from '@/components/common/url-tabs';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useCan } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { errorMessage, saveErrorMessage } from '@/lib/api/errors';
import type { GoodsReceiptDetail, GoodsReceiptLine } from '@/lib/api/types';
import { formatDate, formatDateTime, formatQty } from '@/lib/format';
import {
  useCancelGoodsReceipt,
  useDecideQuarantine,
  useGoodsReceipt,
  useGoodsReceiptActivity,
  useInspectReceiptLine,
  usePostGoodsReceipt,
  type InspectionInput,
} from '../api/hooks';
import {
  availableGrnActions,
  latestInspection,
  needsQuarantineDecision,
  qcOutcomeCounts,
  QC_RESULT_LABELS,
  QC_RESULT_TONES,
  quantityUnderInspection,
  quarantineLines,
} from '../model';
import { QcDialog, type QcMode } from './qc-dialog';

function KeyFacts({ receipt }: { receipt: GoodsReceiptDetail }) {
  const items: SummaryFact[] = [
    { label: 'Purchase order', value: <Link href={`/procurement/orders/${receipt.orderId}`} className="font-mono hover:underline">{receipt.order.number}</Link> },
    { label: 'Supplier', value: <Link href={`/procurement/suppliers/${receipt.supplierId}`} className="hover:underline">{receipt.supplier.name}</Link> },
    { label: 'Project', value: <Link href={`/projects/${receipt.project.id}`} className="hover:underline">{receipt.project.name}</Link> },
    { label: 'Warehouse', value: receipt.warehouse.name },
    { label: 'Received', value: formatDate(receipt.receiptDate) },
    { label: 'Received by', value: receipt.receivedBy?.name ?? '—' },
    {
      label: 'QC by line',
      value: (
        <span className="flex flex-wrap gap-1">
          {qcOutcomeCounts(receipt.lines).map((entry) => (
            <Badge key={entry.result} tone={QC_RESULT_TONES[entry.result]}>
              <span className="num">{entry.count}</span> {QC_RESULT_LABELS[entry.result]}
            </Badge>
          ))}
        </span>
      ),
    },
  ];
  return <SummaryStrip facts={items} />;
}

function QcSummary({ receipt, line }: { receipt: GoodsReceiptDetail; line: GoodsReceiptLine }) {
  if (receipt.status === 'DRAFT') {
    const inspection = latestInspection(line);
    if (!inspection) return <span className="text-xs text-muted-foreground">Not inspected</span>;
    return (
      <div className="space-y-0.5">
        <Badge tone={QC_RESULT_TONES[inspection.result]}>{QC_RESULT_LABELS[inspection.result]}</Badge>
        <p className="text-xs text-muted-foreground">
          Accepted {formatQty(inspection.acceptedQty)}, rejected {formatQty(inspection.rejectedQty)}, quarantine {formatQty(inspection.quarantineQty)}
        </p>
      </div>
    );
  }
  return (
    <div className="min-w-40 space-y-1.5">
      <Badge tone={QC_RESULT_TONES[line.qcResult]}>{QC_RESULT_LABELS[line.qcResult]}</Badge>
      {Number(line.receivedQty) > 0 ? (
        <StackedBar
          label={`${line.item.name} disposition`}
          total={Number(line.receivedQty)}
          segments={[
            { label: 'Accepted', value: Number(line.acceptedQty), tone: 'success' },
            { label: 'Quarantine', value: Number(line.quarantineQty), tone: 'warning' },
            { label: 'Rejected', value: Number(line.rejectedQty), tone: 'danger' },
          ]}
        />
      ) : null}
      {needsQuarantineDecision(line) ? (
        <p className="text-xs text-warning">{formatQty(line.quarantineOpenQty, line.unit)} awaiting a decision</p>
      ) : null}
    </div>
  );
}

function LinesTable({
  receipt,
  canInspect,
  canDecide,
  onQc,
}: {
  receipt: GoodsReceiptDetail;
  canInspect: boolean;
  canDecide: boolean;
  onQc: (line: GoodsReceiptLine, mode: QcMode) => void;
}) {
  const posted = receipt.status === 'POSTED';
  const columns = React.useMemo<DataColumn<GoodsReceiptLine>[]>(
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
            <p className="text-xs text-muted-foreground">
              {[
                row.original.batchNo ? `Batch ${row.original.batchNo}` : null,
                row.original.expiryDate ? `Expires ${formatDate(row.original.expiryDate)}` : null,
                row.original.serialNos.length > 0 ? `${row.original.serialNos.length} serial(s)` : null,
                row.original.location ? row.original.location.fullPath : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {row.original.overReceiving ? <Badge tone="warning">Over-receipt</Badge> : null}
          </div>
        ),
      },
      { id: 'ordered', header: 'Ordered', cell: ({ row }) => formatQty(row.original.ordered, row.original.unit), meta: { numeric: true, hideBelow: 'md' } },
      { id: 'before', header: 'Received before', cell: ({ row }) => formatQty(row.original.previouslyReceived), meta: { numeric: true, hideBelow: 'lg' } },
      { id: 'received', header: 'Delivered', cell: ({ row }) => <span className="font-medium">{formatQty(row.original.receivedQty)}</span>, meta: { numeric: true } },
      {
        id: 'rejected',
        header: 'Rejected at dock',
        cell: ({ row }) => (Number(row.original.rejectedQty) > 0 && !posted ? formatQty(row.original.rejectedQty) : '—'),
        meta: { numeric: true, hideBelow: 'md' },
      },
      ...(posted
        ? ([
            { id: 'accepted', header: 'Accepted', cell: ({ row }) => formatQty(row.original.acceptedQty), meta: { numeric: true } },
            { id: 'rejectedPosted', header: 'Rejected', cell: ({ row }) => formatQty(row.original.rejectedQty), meta: { numeric: true } },
            { id: 'quarantine', header: 'Quarantine', cell: ({ row }) => formatQty(row.original.quarantineQty), meta: { numeric: true } },
          ] satisfies DataColumn<GoodsReceiptLine>[])
        : []),
      { id: 'qc', header: 'QC', cell: ({ row }) => <QcSummary receipt={receipt} line={row.original} /> },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          if (canInspect) {
            return (
              <Button size="sm" onClick={() => onQc(row.original, 'inspect')}>
                <ClipboardCheck className="size-3.5" aria-hidden />
                {latestInspection(row.original) ? 'Edit QC' : 'Record QC'}
              </Button>
            );
          }
          if (canDecide && needsQuarantineDecision(row.original)) {
            return (
              <Button size="sm" variant="primary" onClick={() => onQc(row.original, 'decide')}>
                Decide
              </Button>
            );
          }
          return null;
        },
      },
    ],
    [receipt, posted, canInspect, canDecide, onQc],
  );
  return (
    <DataTable
      caption="Goods receipt lines"
      columns={columns}
      data={receipt.lines}
      getRowId={(line) => line.id}
      loading={false}
      maxHeightClassName="max-h-[60vh]"
      emptyState={<EmptyState compact title="No lines" />}
    />
  );
}

function Details({ receipt }: { receipt: GoodsReceiptDetail }) {
  return (
    <Panel title="Delivery details">
      <DetailList
        items={[
          { label: 'Supplier delivery receipt no.', value: receipt.supplierDrNo },
          { label: 'Vehicle', value: receipt.vehicle },
          { label: 'Driver', value: receipt.driver },
          { label: 'Posted', value: receipt.postedAt ? formatDateTime(receipt.postedAt) : 'Not posted' },
          { label: 'Over-receipt reason', value: receipt.overReceiptReason },
          { label: 'Cancelled', value: receipt.cancelledAt ? `${formatDateTime(receipt.cancelledAt)}: ${receipt.cancelReason ?? ''}` : null },
          { label: 'Remarks', value: receipt.remarks, wide: true },
        ]}
      />
    </Panel>
  );
}

export function GoodsReceiptDetailView({ id }: { id: string }) {
  const query = useGoodsReceipt(id);
  const receipt = query.data;
  const scope = { projectId: receipt?.project.id, warehouseId: receipt?.warehouseId };
  const canPost = useCan('procurement.receipt', 'POST', scope);
  const canCancel = useCan('procurement.receipt', 'CANCEL', scope);
  const canInspect = useCan('procurement.receipt', 'APPROVE', scope);
  const canOverride = useCan('procurement.receipt', 'OVERRIDE', scope);
  const activity = useGoodsReceiptActivity(id);
  const post = usePostGoodsReceipt(id);
  const cancel = useCancelGoodsReceipt(id);
  const inspect = useInspectReceiptLine(id);
  const decide = useDecideQuarantine(id);
  const [dialog, setDialog] = React.useState<'post' | 'over-receipt' | 'cancel' | null>(null);
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const [qc, setQc] = React.useState<{ line: GoodsReceiptLine; mode: QcMode } | null>(null);
  const [qcError, setQcError] = React.useState<string | null>(null);
  const postKey = React.useRef<string | null>(null);
  const cancelKey = React.useRef<string | null>(null);
  const decideKey = React.useRef<string | null>(null);

  const actions = receipt ? availableGrnActions(receipt.status, { post: canPost, cancel: canCancel, inspect: canInspect }) : null;
  const overReceiving = receipt?.status === 'DRAFT' && receipt.lines.some((line) => line.overReceiving);
  const awaitingDecision = receipt ? quarantineLines(receipt).length : 0;

  function openDialog(next: 'post' | 'over-receipt' | 'cancel'): void {
    setDialogError(null);
    setDialog(next);
  }

  function doPost(overReceiptReason?: string): void {
    postKey.current ??= newIdempotencyKey();
    setDialogError(null);
    post.mutate(
      { idempotencyKey: postKey.current, body: overReceiptReason ? { overReceipt: { reason: overReceiptReason } } : {} },
      {
        onSuccess: (posted) => {
          postKey.current = null;
          setDialog(null);
          toast.success('Receipt posted', `${posted.number} is now in stock.`);
        },
        onError: (error) => setDialogError(saveErrorMessage(error)),
      },
    );
  }

  function doCancel(reason: string): void {
    cancelKey.current ??= newIdempotencyKey();
    setDialogError(null);
    cancel.mutate(
      { reason, idempotencyKey: cancelKey.current },
      {
        onSuccess: () => {
          cancelKey.current = null;
          setDialog(null);
          toast.success('Receipt cancelled');
        },
        onError: (error) => setDialogError(errorMessage(error)),
      },
    );
  }

  function doQc(body: InspectionInput): void {
    if (!qc) return;
    setQcError(null);
    const lineId = qc.line.id;
    const handlers = {
      onSuccess: () => {
        decideKey.current = null;
        setQc(null);
        toast.success(qc.mode === 'inspect' ? 'Inspection recorded' : 'Quarantine decision recorded');
      },
      onError: (error: unknown) => setQcError(saveErrorMessage(error)),
    };
    if (qc.mode === 'inspect') {
      inspect.mutate({ lineId, body }, handlers);
      return;
    }
    decideKey.current ??= newIdempotencyKey();
    decide.mutate({ lineId, body, idempotencyKey: decideKey.current }, handlers);
  }

  return (
    <PermissionGate module="procurement.receipt">
      {query.isPending ? (
        <DetailPageSkeleton label="Loading goods receipt" />
      ) : query.isError || !receipt || !actions ? (
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <PageHeader
            title={receipt.number}
            breadcrumbs={[{ label: 'Inventory' }, { label: 'Goods receipts', href: '/inventory/receipts' }, { label: receipt.number }]}
            meta={<StatusBadge status={receipt.status} />}
            actions={
              <>
                {actions.cancel ? (
                  <Button onClick={() => openDialog('cancel')}>
                    <Ban className="size-3.5" aria-hidden />
                    {receipt.status === 'POSTED' ? 'Reverse receipt' : 'Cancel'}
                  </Button>
                ) : null}
                {actions.post ? (
                  <Button
                    variant="primary"
                    disabled={overReceiving && !canOverride}
                    onClick={() => openDialog(overReceiving ? 'over-receipt' : 'post')}
                  >
                    <PackageCheck className="size-3.5" aria-hidden />
                    Post to stock
                  </Button>
                ) : null}
              </>
            }
          />
          {overReceiving ? (
            <Alert tone="warning" title="Quantities exceed what is open on the purchase order" className="mb-4">
              {canOverride
                ? 'Posting needs a reason and must stay within the company over-receipt tolerance.'
                : 'Posting an over-receipt needs the override permission. Reduce the delivered quantities or ask someone who has it.'}
            </Alert>
          ) : null}
          {awaitingDecision > 0 ? (
            <Alert tone="warning" title="Quarantined goods are waiting for a QC decision" className="mb-4">
              {awaitingDecision} {awaitingDecision === 1 ? 'line holds' : 'lines hold'} stock in quarantine. Release it to available stock or reject it back to the supplier.
            </Alert>
          ) : null}
          <KeyFacts receipt={receipt} />
          <UrlTabs
            label="Goods receipt sections"
            tabs={[
              {
                id: 'lines',
                label: 'Lines',
                count: receipt.lines.length,
                content: <LinesTable receipt={receipt} canInspect={actions.inspect} canDecide={actions.decideQuarantine} onQc={(line, mode) => { setQcError(null); setQc({ line, mode }); }} />,
              },
              { id: 'details', label: 'Details', content: <Details receipt={receipt} /> },
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
            open={dialog === 'post'}
            onOpenChange={(open) => (open ? undefined : setDialog(null))}
            title={`Post ${receipt.number}?`}
            description="Accepted goods are added to stock and quarantined goods are held for a QC decision. A posted receipt can only be reversed, not edited."
            confirmLabel="Post to stock"
            loading={post.isPending}
            onConfirm={() => doPost()}
          >
            {dialogError ? <Alert tone="danger">{dialogError}</Alert> : null}
          </ConfirmDialog>
          <ReasonDialog
            open={dialog === 'over-receipt'}
            onOpenChange={(open) => (open ? undefined : setDialog(null))}
            title={`Post ${receipt.number} with over-receipt?`}
            description="More was delivered than is open on the purchase order. Explain why it is accepted."
            confirmLabel="Post to stock"
            minLength={5}
            loading={post.isPending}
            error={dialogError}
            onConfirm={(reason) => doPost(reason)}
          />
          <ReasonDialog
            open={dialog === 'cancel'}
            onOpenChange={(open) => (open ? undefined : setDialog(null))}
            title={receipt.status === 'POSTED' ? `Reverse ${receipt.number}?` : `Cancel ${receipt.number}?`}
            description={
              receipt.status === 'POSTED'
                ? 'The stock it added is taken back out and the received quantities return to the purchase order. This fails if the stock has already been used or moved.'
                : 'The draft receipt is discarded. Nothing has reached stock.'
            }
            confirmLabel={receipt.status === 'POSTED' ? 'Reverse receipt' : 'Cancel receipt'}
            tone="danger"
            loading={cancel.isPending}
            error={dialogError}
            onConfirm={doCancel}
          />
          <QcDialog
            open={qc !== null}
            onOpenChange={(open) => (open ? undefined : setQc(null))}
            mode={qc?.mode ?? 'inspect'}
            line={qc?.line ?? null}
            underInspection={qc ? quantityUnderInspection(receipt.status, qc.line) : '0'}
            loading={inspect.isPending || decide.isPending}
            error={qcError}
            onSubmit={doQc}
          />
        </>
      )}
    </PermissionGate>
  );
}
