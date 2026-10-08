import { toCsv } from '@/lib/csv';
import type { PurchaseOrderDetail } from '@/lib/api/types';

export const PO_CANCELLABLE = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT'];
export const PO_CLOSABLE = ['SENT', 'PARTIALLY_RECEIVED', 'RECEIVED'];

export type PoActions = {
  edit: boolean;
  submit: boolean;
  send: boolean;
  cancel: boolean;
  close: boolean;
};

export type PoPermissions = {
  edit: boolean;
  submit: boolean;
  send: boolean;
  cancel: boolean;
  close: boolean;
};

/** Which workflow actions to offer for a status, given what the user's role may do. Approval has its own panel. */
export function availablePoActions(status: string, can: PoPermissions): PoActions {
  return {
    edit: status === 'DRAFT' && can.edit,
    submit: status === 'DRAFT' && can.submit,
    send: status === 'APPROVED' && can.send,
    cancel: PO_CANCELLABLE.includes(status) && can.cancel,
    close: PO_CLOSABLE.includes(status) && can.close,
  };
}

/** Quantities of a line as numbers for display checks: what is still open to receive. */
export function lineProgress(line: PurchaseOrderDetail['lines'][number]): {
  fullyReceived: boolean;
  hasCancelled: boolean;
} {
  return {
    fullyReceived: Number(line.openQty) <= 0 && Number(line.receivedQty) > 0,
    hasCancelled: Number(line.cancelledQty) > 0,
  };
}

/** Line items of a purchase order as CSV, generated from the loaded record (nothing is fetched or invented). */
export function purchaseOrderCsv(po: PurchaseOrderDetail): string {
  return toCsv([
    ['Purchase order', po.number],
    ['Supplier', po.supplier.name],
    ['Project', `${po.project.code} ${po.project.name}`],
    ['Warehouse', po.warehouse.name],
    ['Order date', po.orderDate.slice(0, 10)],
    ['Expected delivery', po.expectedDate ? po.expectedDate.slice(0, 10) : ''],
    ['Status', po.status],
    ['Currency', po.currency],
    [],
    [
      'Line',
      'SKU',
      'Item',
      'Description',
      'Unit',
      'Ordered',
      'Received',
      'Cancelled',
      'Open',
      'Unit price',
      'Discount %',
      'VAT %',
      'Line total (excl. VAT)',
      'VAT',
    ],
    ...po.lines.map((line) => [
      line.lineNo,
      line.item.sku,
      line.item.name,
      line.description ?? '',
      line.unit,
      line.qty,
      line.receivedQty,
      line.cancelledQty,
      line.openQty,
      line.unitPrice,
      line.discountPct,
      line.taxPct,
      line.lineTotal,
      line.taxAmount,
    ]),
    [],
    ['Subtotal', '', '', '', '', '', '', '', '', '', '', '', po.subtotal],
    ['Discount', '', '', '', '', '', '', '', '', '', '', '', po.discount],
    ['Freight', '', '', '', '', '', '', '', '', '', '', '', po.freight],
    ['VAT', '', '', '', '', '', '', '', '', '', '', '', po.taxAmount],
    ['Total', '', '', '', '', '', '', '', '', '', '', '', po.totalAmount],
  ]);
}
