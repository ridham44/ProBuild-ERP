'use client';

import { newIdempotencyKey } from '@probuild/api-client';
import { Ban, FileSpreadsheet, Lock, Pencil, Plus, Send, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { ActivityPanel } from '@/components/common/activity-panel';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { QueryErrorState } from '@/components/common/error-state';
import { DetailPageSkeleton } from '@/components/common/page-skeleton';
import { PageHeader } from '@/components/common/page-header';
import { DetailList, Panel } from '@/components/common/panel';
import { ReasonDialog } from '@/components/common/reason-dialog';
import { StatusBadge } from '@/components/common/status-badge';
import { UrlTabs } from '@/components/common/url-tabs';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useCan } from '@/features/auth/components/current-user';
import { PermissionGate } from '@/features/auth/components/permission-gate';
import { CreatePoFromQuotationDialog } from '@/features/purchase-orders/components/create-po-dialog';
import { useRequisition } from '@/features/requisitions/api/hooks';
import { errorMessage } from '@/lib/api/errors';
import type { RfqDetail } from '@/lib/api/types';
import { formatDate, formatPHP, formatQty } from '@/lib/format';
import {
  useAwardRfq,
  useCloseOrCancelRfq,
  useComparison,
  useRfq,
  useRfqActivity,
  useSendRfq,
} from '../api/hooks';
import type { ComparisonSupplier } from '../comparison-model';
import { ComparisonMatrix } from './comparison-matrix';
import { QuotationDialog } from './quotation-dialog';

function Overview({ rfq }: { rfq: RfqDetail }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="RFQ">
          <DetailList
            columns={2}
            items={[
              { label: 'Project', value: <Link href={`/projects/${rfq.projectId}`} className="text-primary hover:underline">{rfq.project.code} · {rfq.project.name}</Link> },
              { label: 'Requisition', value: rfq.requisition ? <Link href={`/procurement/requests/${rfq.requisition.id}`} className="doc-link">{rfq.requisition.number}</Link> : null },
              { label: 'Quotations due', value: formatDate(rfq.dueDate) },
              { label: 'Goods needed by', value: formatDate(rfq.requiredDate) },
              { label: 'Delivery location', value: rfq.deliveryLocation, wide: true },
              { label: 'Delivery requirements', value: rfq.deliveryRequirements, wide: true },
              { label: 'Notes', value: rfq.remarks, wide: true },
            ]}
          />
        </Panel>
        <Panel title="Timeline">
          <DetailList
            columns={2}
            items={[
              { label: 'Created', value: formatDate(rfq.createdAt) },
              { label: 'Sent to suppliers', value: rfq.sentAt ? formatDate(rfq.sentAt) : null },
              { label: 'Awarded', value: rfq.awardedAt ? formatDate(rfq.awardedAt) : null },
              { label: 'Closed', value: rfq.closedAt ? formatDate(rfq.closedAt) : null },
              { label: 'Cancelled', value: rfq.cancelledAt ? formatDate(rfq.cancelledAt) : null },
              { label: 'Award reason', value: rfq.award?.reason, wide: true },
            ]}
          />
        </Panel>
      </div>
      <Panel title="Items" bodyClassName="p-0">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-2 py-2 font-medium">Item</th>
              <th className="px-2 py-2 text-right font-medium">Quantity</th>
              <th className="px-4 py-2 text-right font-medium">Needed by</th>
            </tr>
          </thead>
          <tbody>
            {rfq.lines.map((line) => (
              <tr key={line.id} className="border-t border-border">
                <td className="num px-4 py-1.5 text-muted-foreground">{line.lineNo}</td>
                <td className="px-2 py-1.5">
                  <span className="font-medium">{line.item.name}</span> <span className="font-mono text-xs text-muted-foreground">{line.item.sku}</span>
                  {line.description && line.description !== line.item.name ? <p className="text-xs text-muted-foreground">{line.description}</p> : null}
                </td>
                <td className="num px-2 py-1.5 text-right">{formatQty(line.qty, line.unit)}</td>
                <td className="num px-4 py-1.5 text-right">{formatDate(line.requiredDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function Suppliers({
  rfq,
  canEnter,
  onEnter,
}: {
  rfq: RfqDetail;
  canEnter: boolean;
  onEnter: (supplierId: string, quotationId: string | null) => void;
}) {
  const quotable = rfq.status === 'SENT' || rfq.status === 'QUOTED';
  return (
    <Panel
      title="Invited suppliers"
      description={quotable ? 'Enter each supplier’s quotation as it arrives.' : rfq.status === 'DRAFT' ? 'Send the RFQ to open quotation entry.' : undefined}
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Supplier</th>
              <th className="px-2 py-2 font-medium">Invitation</th>
              <th className="hidden px-2 py-2 font-medium sm:table-cell">Responded</th>
              <th className="px-2 py-2 font-medium">Quotation</th>
              <th className="px-2 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rfq.suppliers.map((invite) => {
              const quotation = rfq.quotations.find((entry) => entry.supplierId === invite.supplierId);
              return (
                <tr key={invite.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link href={`/procurement/suppliers/${invite.supplierId}`} className="font-medium hover:underline">
                      {invite.supplier.name}
                    </Link>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-mono">{invite.supplier.code}</span>
                      {invite.supplier.accredited ? <Badge tone="approved">Accredited</Badge> : null}
                    </p>
                  </td>
                  <td className="px-2 py-2">
                    <StatusBadge status={invite.status} />
                  </td>
                  <td className="hidden px-2 py-2 text-muted-foreground sm:table-cell">{formatDate(invite.respondedAt)}</td>
                  <td className="px-2 py-2">
                    {quotation ? (
                      <span>
                        {quotation.quoteNo ? <span className="font-mono text-xs">{quotation.quoteNo} · </span> : null}
                        <StatusBadge status={quotation.status} />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Not received</span>
                    )}
                  </td>
                  <td className="num px-2 py-2 text-right">{quotation ? formatPHP(quotation.totalAmount) : '—'}</td>
                  <td className="px-4 py-2 text-right">
                    {canEnter && quotable ? (
                      quotation ? (
                        quotation.status === 'SUBMITTED' ? (
                          <Button size="sm" onClick={() => onEnter(invite.supplierId, quotation.id)}>
                            <Pencil className="size-3.5" aria-hidden />
                            Revise
                          </Button>
                        ) : null
                      ) : (
                        <Button size="sm" variant="primary" onClick={() => onEnter(invite.supplierId, null)}>
                          <Plus className="size-3.5" aria-hidden />
                          Enter quotation
                        </Button>
                      )
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ComparisonTab({
  rfq,
  canAward,
  onAward,
}: {
  rfq: RfqDetail;
  canAward: boolean;
  onAward: (supplier: ComparisonSupplier) => void;
}) {
  const comparison = useComparison(rfq.id, rfq.quotations.length > 0);
  if (rfq.quotations.length === 0) {
    return (
      <Panel>
        <EmptyState
          compact
          icon={FileSpreadsheet}
          title="Nothing to compare yet"
          description="Once suppliers' quotations are entered, their prices, delivery and totals line up here side by side."
        />
      </Panel>
    );
  }
  if (comparison.isPending) return <Skeleton className="h-72" />;
  if (comparison.isError) return <QueryErrorState error={comparison.error} onRetry={() => void comparison.refetch()} />;
  return (
    <div className="space-y-3">
      <ComparisonMatrix comparison={comparison.data} canAward={canAward} onAward={onAward} />
      <p className="text-xs text-muted-foreground">
        Prices are net of discount and before VAT. Green marks the lowest price per item and the lowest total; variance is measured against the lowest.
      </p>
    </div>
  );
}

export function RfqDetailView({ id }: { id: string }) {
  const query = useRfq(id);
  const rfq = query.data;
  const scope = { projectId: rfq?.projectId };
  const canEdit = useCan('procurement.rfq', 'EDIT', scope);
  const canSend = useCan('procurement.rfq', 'POST', scope);
  const canCancel = useCan('procurement.rfq', 'CANCEL', scope);
  const canClose = useCan('procurement.rfq', 'CLOSE', scope);
  const canEnter = useCan('procurement.rfq', 'CREATE', scope);
  const canAward = useCan('procurement.rfq', 'APPROVE', scope);
  const canCreatePo = useCan('procurement.order', 'CREATE', scope);
  const activity = useRfqActivity(id);
  const requisition = useRequisition(rfq?.requisitionId ?? '', Boolean(rfq?.requisitionId));
  const send = useSendRfq(id);
  const closeOrCancel = useCloseOrCancelRfq(id);
  const award = useAwardRfq(id);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [reasonFor, setReasonFor] = React.useState<'cancel' | 'close' | null>(null);
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [quote, setQuote] = React.useState<{ supplierId: string; quotationId: string | null } | null>(null);
  const [awarding, setAwarding] = React.useState<ComparisonSupplier | null>(null);
  const [awardError, setAwardError] = React.useState<string | null>(null);
  const [poOpen, setPoOpen] = React.useState(false);
  const awardKey = React.useRef<string | null>(null);

  function doAward(reason: string): void {
    if (!awarding) return;
    setAwardError(null);
    awardKey.current ??= newIdempotencyKey();
    award.mutate(
      { quotationId: awarding.quotationId, ...(reason ? { reason } : {}), idempotencyKey: awardKey.current },
      {
        onSuccess: () => {
          awardKey.current = null;
          toast.success(`Awarded to ${awarding.name}`, 'Create the purchase order from the awarded quotation.');
          setAwarding(null);
        },
        onError: (error) => setAwardError(errorMessage(error)),
      },
    );
  }

  const awarded = rfq?.quotations.find((entry) => entry.id === rfq.awardedQuotationId);
  const awardedInvite = awarded ? rfq?.suppliers.find((entry) => entry.supplierId === awarded.supplierId) : undefined;

  return (
    <PermissionGate module="procurement.rfq">
      {query.isPending ? (
        <DetailPageSkeleton label="Loading RFQ" />
      ) : query.isError || !rfq ? (
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <PageHeader
            title={rfq.number}
            breadcrumbs={[{ label: 'Procurement' }, { label: 'RFQs', href: '/procurement/rfqs' }, { label: rfq.number }]}
            meta={<StatusBadge status={rfq.status} />}
            actions={
              <>
                {rfq.status === 'DRAFT' && canEdit ? (
                  <Button asChild>
                    <Link href={`/procurement/rfqs/${id}/edit`}>
                      <Pencil className="size-3.5" aria-hidden />
                      Edit
                    </Link>
                  </Button>
                ) : null}
                {['DRAFT', 'SENT', 'QUOTED'].includes(rfq.status) && canCancel ? (
                  <Button onClick={() => setReasonFor('cancel')}>
                    <Ban className="size-3.5" aria-hidden />
                    Cancel
                  </Button>
                ) : null}
                {['SENT', 'QUOTED', 'AWARDED'].includes(rfq.status) && canClose ? (
                  <Button onClick={() => setReasonFor('close')}>
                    <Lock className="size-3.5" aria-hidden />
                    Close
                  </Button>
                ) : null}
                {rfq.status === 'DRAFT' && canSend ? (
                  <Button variant="primary" onClick={() => setSendOpen(true)}>
                    <Send className="size-3.5" aria-hidden />
                    Send to suppliers
                  </Button>
                ) : null}
                {rfq.status === 'AWARDED' && awarded && canCreatePo ? (
                  <Button variant="primary" onClick={() => setPoOpen(true)}>
                    <ShoppingCart className="size-3.5" aria-hidden />
                    Create purchase order
                  </Button>
                ) : null}
              </>
            }
          />
          {rfq.status === 'AWARDED' && awarded ? (
            <Alert tone="success" title={`Awarded to ${awardedInvite?.supplier.name ?? 'supplier'}`} className="mb-4">
              Quotation total {formatPHP(awarded.totalAmount)}. Next step: create the purchase order from this quotation.
            </Alert>
          ) : null}
          <UrlTabs
            label="RFQ sections"
            tabs={[
              { id: 'overview', label: 'Overview', content: <Overview rfq={rfq} /> },
              {
                id: 'suppliers',
                label: 'Suppliers and quotations',
                count: rfq.quotations.length,
                content: <Suppliers rfq={rfq} canEnter={canEnter} onEnter={(supplierId, quotationId) => setQuote({ supplierId, quotationId })} />,
              },
              {
                id: 'comparison',
                label: 'Comparison',
                content: <ComparisonTab rfq={rfq} canAward={canAward && ['SENT', 'QUOTED'].includes(rfq.status)} onAward={setAwarding} />,
              },
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
            open={sendOpen}
            onOpenChange={setSendOpen}
            title={`Send ${rfq.number}?`}
            description={`The RFQ is issued to ${rfq.suppliers.length} supplier${rfq.suppliers.length === 1 ? '' : 's'} and can no longer be edited. You can then enter their quotations.`}
            confirmLabel="Send RFQ"
            loading={send.isPending}
            onConfirm={() =>
              send.mutate(undefined, {
                onSuccess: () => {
                  toast.success('RFQ sent', 'Enter quotations as suppliers respond.');
                  setSendOpen(false);
                },
                onError: (error) => {
                  toast.error('Could not send the RFQ', errorMessage(error));
                  setSendOpen(false);
                },
              })
            }
          />
          <ReasonDialog
            open={reasonFor !== null}
            onOpenChange={(open) => (open ? undefined : setReasonFor(null))}
            title={reasonFor === 'cancel' ? `Cancel ${rfq.number}?` : `Close ${rfq.number}?`}
            description={
              reasonFor === 'cancel'
                ? 'Suppliers will no longer be expected to quote. The requisition lines become available for a new RFQ.'
                : 'The RFQ is finished. Quotations stay on record.'
            }
            confirmLabel={reasonFor === 'cancel' ? 'Cancel RFQ' : 'Close RFQ'}
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
                    toast.success(reasonFor === 'cancel' ? 'RFQ cancelled' : 'RFQ closed');
                    setReasonFor(null);
                  },
                  onError: (error) => setReasonError(errorMessage(error)),
                },
              );
            }}
          />
          {quote ? (
            <QuotationDialog
              open
              onOpenChange={(open) => (open ? undefined : setQuote(null))}
              rfq={rfq}
              supplierId={quote.supplierId}
              quotationId={quote.quotationId}
            />
          ) : null}
          <ReasonDialog
            open={awarding !== null}
            onOpenChange={(open) => (open ? undefined : setAwarding(null))}
            title={`Award to ${awarding?.name ?? ''}?`}
            description={
              awarding
                ? `You are awarding ${rfq.number} at ${formatPHP(awarding.totalAmount)}. The other quotations are marked not awarded and the RFQ closes to further quotes. This cannot be undone.`
                : ''
            }
            confirmLabel="Award quotation"
            required={false}
            fieldLabel="Reason for the award (optional)"
            loading={award.isPending}
            error={awardError}
            onConfirm={doAward}
          />
          {awarded ? (
            <CreatePoFromQuotationDialog
              open={poOpen}
              onOpenChange={setPoOpen}
              quotationId={awarded.id}
              supplierName={awardedInvite?.supplier.name ?? 'the supplier'}
              total={awarded.totalAmount}
              paymentTerms={null}
              defaultWarehouseId={requisition.data?.warehouseId ?? null}
            />
          ) : null}
        </>
      )}
    </PermissionGate>
  );
}
