'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { TextAreaField, TextField } from '@/components/common/form-controls';
import { Panel } from '@/components/common/panel';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { saveErrorMessage } from '@/lib/api/errors';
import type { ReceivableLines } from '@/lib/api/types';
import { formatQty, manilaToday } from '@/lib/format';
import { useCreateGoodsReceipt, type GoodsReceiptInput } from '../api/hooks';
import {
  splitSerials,
  validateReceiptLine,
  type ReceiptLineDraft,
  type ReceiptLineErrors,
} from '../model';

type OrderLine = ReceivableLines['lines'][number];

function initialDraft(line: OrderLine): ReceiptLineDraft {
  return {
    orderLineId: line.orderLineId,
    receivedQty: Number(line.remaining) > 0 ? line.remaining : '',
    rejectedQty: '',
    rejectionReason: '',
    batchNo: '',
    expiryDate: '',
    serials: '',
  };
}

function cleanQty(value: string): string {
  return value.replace(/[^\d.]/g, '');
}

function LineRow({
  line,
  draft,
  errors,
  onChange,
}: {
  line: OrderLine;
  draft: ReceiptLineDraft;
  errors: ReceiptLineErrors;
  onChange: (change: Partial<ReceiptLineDraft>) => void;
}) {
  const { trackBatch, trackExpiry, trackSerial } = line.item;
  const name = line.item.name;
  const error = (text?: string) => (text ? <p className="text-2xs font-medium text-danger">{text}</p> : null);
  return (
    <tr className="border-t border-border align-top">
      <td className="px-4 py-2">
        <p className="font-medium">{name}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {line.item.sku} · line {line.lineNo}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Ordered {formatQty(line.ordered, line.unit)}, received {formatQty(line.previouslyReceived)}, open{' '}
          <span className="font-medium text-foreground">{formatQty(line.remaining)}</span>
        </p>
      </td>
      <td className="w-32 px-2 py-2">
        <Input
          aria-label={`Quantity received for ${name}`}
          inputMode="decimal"
          value={draft.receivedQty}
          aria-invalid={errors.receivedQty ? true : undefined}
          onChange={(event) => onChange({ receivedQty: cleanQty(event.target.value) })}
          className="num h-8 px-2 text-right"
        />
        {error(errors.receivedQty)}
      </td>
      <td className="w-32 px-2 py-2">
        <Input
          aria-label={`Quantity rejected at the dock for ${name}`}
          inputMode="decimal"
          value={draft.rejectedQty}
          aria-invalid={errors.rejectedQty ? true : undefined}
          onChange={(event) => onChange({ rejectedQty: cleanQty(event.target.value) })}
          className="num h-8 px-2 text-right"
        />
        {error(errors.rejectedQty)}
      </td>
      <td className="min-w-56 space-y-1.5 px-2 py-2">
        <Input
          aria-label={`Rejection reason for ${name}`}
          placeholder="Rejection reason"
          maxLength={300}
          value={draft.rejectionReason}
          onChange={(event) => onChange({ rejectionReason: event.target.value })}
          className="h-8 px-2 text-xs"
        />
        {trackBatch ? (
          <>
            <Input
              aria-label={`Batch number for ${name}`}
              placeholder="Batch number"
              maxLength={60}
              value={draft.batchNo}
              aria-invalid={errors.batchNo ? true : undefined}
              onChange={(event) => onChange({ batchNo: event.target.value })}
              className="h-8 px-2 text-xs"
            />
            {error(errors.batchNo)}
          </>
        ) : null}
        {trackExpiry ? (
          <>
            <Input
              aria-label={`Expiry date for ${name}`}
              type="date"
              value={draft.expiryDate}
              aria-invalid={errors.expiryDate ? true : undefined}
              onChange={(event) => onChange({ expiryDate: event.target.value })}
              className="h-8 px-2 text-xs"
            />
            {error(errors.expiryDate)}
          </>
        ) : null}
        {trackSerial ? (
          <>
            <Textarea
              aria-label={`Serial numbers for ${name}`}
              rows={3}
              placeholder="One serial per unit: accepted units first, then quarantined, then rejected"
              value={draft.serials}
              aria-invalid={errors.serials ? true : undefined}
              onChange={(event) => onChange({ serials: event.target.value })}
              className="text-xs"
            />
            {error(errors.serials)}
          </>
        ) : null}
      </td>
    </tr>
  );
}

/** Draft receipt against a purchase order. Lines with no quantity are left out of the receipt. */
export function GoodsReceiptForm({ order }: { order: ReceivableLines }) {
  const router = useRouter();
  const create = useCreateGoodsReceipt();
  const [drafts, setDrafts] = React.useState<ReceiptLineDraft[]>(() => order.lines.map(initialDraft));
  const [receiptDate, setReceiptDate] = React.useState(manilaToday());
  const [supplierDrNo, setSupplierDrNo] = React.useState('');
  const [vehicle, setVehicle] = React.useState('');
  const [driver, setDriver] = React.useState('');
  const [remarks, setRemarks] = React.useState('');
  const [showErrors, setShowErrors] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const included = drafts.filter((draft) => draft.receivedQty.trim() !== '');
  const lineErrors = new Map(
    included.map((draft) => {
      const line = order.lines.find((entry) => entry.orderLineId === draft.orderLineId);
      return [draft.orderLineId, line ? validateReceiptLine(draft, line.item) : {}] as const;
    }),
  );
  const valid = included.length > 0 && [...lineErrors.values()].every((errors) => Object.keys(errors).length === 0);

  function patch(orderLineId: string, change: Partial<ReceiptLineDraft>): void {
    setDrafts((current) => current.map((draft) => (draft.orderLineId === orderLineId ? { ...draft, ...change } : draft)));
  }

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (create.isPending) return;
    setShowErrors(true);
    setServerError(null);
    if (!valid) return;
    const body: GoodsReceiptInput = {
      orderId: order.orderId,
      receiptDate,
      ...(supplierDrNo.trim() ? { supplierDrNo: supplierDrNo.trim() } : {}),
      ...(vehicle.trim() ? { vehicle: vehicle.trim() } : {}),
      ...(driver.trim() ? { driver: driver.trim() } : {}),
      ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
      lines: included.map((draft) => ({
        orderLineId: draft.orderLineId,
        receivedQty: draft.receivedQty,
        ...(draft.rejectedQty ? { rejectedQty: draft.rejectedQty } : {}),
        ...(draft.rejectionReason.trim() ? { rejectionReason: draft.rejectionReason.trim() } : {}),
        ...(draft.batchNo.trim() ? { batchNo: draft.batchNo.trim() } : {}),
        ...(draft.expiryDate ? { expiryDate: draft.expiryDate } : {}),
        ...(draft.serials.trim() ? { serialNos: splitSerials(draft.serials) } : {}),
      })),
    };
    create.mutate(body, {
      onSuccess: (receipt) => {
        toast.success('Goods receipt created', `${receipt.number} is a draft. Record QC if needed, then post it.`);
        router.push(`/inventory/receipts/${receipt.id}`);
      },
      onError: (error) => setServerError(saveErrorMessage(error)),
    });
  }

  if (!order.receivable) {
    return (
      <Alert tone="warning" title="This purchase order cannot receive goods">
        {order.orderNumber} is {order.status.toLowerCase().replace(/_/g, ' ')}. Goods can only be received against an approved, sent or partly
        received order.
      </Alert>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
      {showErrors && included.length === 0 ? <Alert tone="warning">Enter a received quantity for at least one line.</Alert> : null}
      <Panel title="Delivery">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextField label="Receipt date" type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} />
          <TextField label="Supplier delivery receipt no." maxLength={60} value={supplierDrNo} onChange={(event) => setSupplierDrNo(event.target.value)} />
          <TextField label="Vehicle" maxLength={60} value={vehicle} onChange={(event) => setVehicle(event.target.value)} />
          <TextField label="Driver" maxLength={100} value={driver} onChange={(event) => setDriver(event.target.value)} />
          <TextAreaField label="Remarks" wide className="sm:col-span-2 lg:col-span-4" maxLength={1000} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
        </div>
      </Panel>
      <Panel
        title="Lines"
        description={`${order.orderNumber}. Clear the quantity of a line that was not delivered. Over-receipt up to ${formatQty(order.overReceiptTolerancePct)}% needs a reason when posting.`}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Item</th>
                <th className="w-32 px-2 py-2 text-right font-medium">Received</th>
                <th className="w-32 px-2 py-2 text-right font-medium">Rejected at dock</th>
                <th className="px-2 py-2 font-medium">Batch, expiry, serials</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => {
                const draft = drafts.find((entry) => entry.orderLineId === line.orderLineId);
                if (!draft) return null;
                return (
                  <LineRow
                    key={line.orderLineId}
                    line={line}
                    draft={draft}
                    errors={showErrors ? (lineErrors.get(line.orderLineId) ?? {}) : {}}
                    onChange={(change) => patch(line.orderLineId, change)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" loading={create.isPending}>
          Create draft receipt
        </Button>
        <Button asChild variant="ghost" disabled={create.isPending}>
          <Link href="/inventory/receipts">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
