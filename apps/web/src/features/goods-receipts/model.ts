import type { BadgeTone } from '@/components/ui/badge';
import type { GoodsReceiptDetail, GoodsReceiptLine } from '@/lib/api/types';
import { compareDecimal, isDecimal, subDecimal, sumDecimal } from '@/lib/decimal';
import type { InspectionInput } from './api/hooks';

export type GrnPermissions = { post: boolean; cancel: boolean; inspect: boolean };

export type GrnActions = {
  post: boolean;
  cancel: boolean;
  /** Record QC on a draft line. */
  inspect: boolean;
  /** Release or reject quarantined stock of a posted receipt. */
  decideQuarantine: boolean;
};

/** Which workflow actions to offer for a receipt status, given what the user's role may do. */
export function availableGrnActions(status: string, can: GrnPermissions): GrnActions {
  return {
    post: status === 'DRAFT' && can.post,
    cancel: (status === 'DRAFT' || status === 'POSTED') && can.cancel,
    inspect: status === 'DRAFT' && can.inspect,
    decideQuarantine: status === 'POSTED' && can.inspect,
  };
}

export const QC_RESULT_LABELS: Record<GoodsReceiptLine['qcResult'], string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  QUARANTINED: 'Quarantined',
  PARTIAL: 'Partly accepted',
};

export const QC_RESULT_TONES: Record<GoodsReceiptLine['qcResult'], BadgeTone> = {
  PENDING: 'neutral',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  QUARANTINED: 'warning',
  PARTIAL: 'info',
};

/** A posted line still holding quarantined stock that needs a QC decision. */
export function needsQuarantineDecision(line: GoodsReceiptLine): boolean {
  return Number(line.quarantineOpenQty) > 0;
}

export function quarantineLines(receipt: GoodsReceiptDetail): GoodsReceiptLine[] {
  return receipt.status === 'POSTED' ? receipt.lines.filter(needsQuarantineDecision) : [];
}

/** Quantity a QC inspection has to account for: a draft line's quantity minus dock rejections, or the open quarantine. */
export function quantityUnderInspection(receiptStatus: string, line: GoodsReceiptLine): string {
  return receiptStatus === 'POSTED' ? line.quarantineOpenQty : subDecimal(line.receivedQty, line.rejectedQty, 4);
}

export type InspectionDraft = {
  outcome: 'PASS' | 'FAIL' | 'PARTIAL';
  acceptedQty: string;
  rejectedQty: string;
  quarantineQty: string;
  reason: string;
  remarks: string;
  testResult: string;
  certificateNo: string;
};

export function blankInspection(): InspectionDraft {
  return { outcome: 'PASS', acceptedQty: '', rejectedQty: '', quarantineQty: '', reason: '', remarks: '', testResult: '', certificateNo: '' };
}

const QTY = /^\d+(\.\d{1,4})?$/;
const REASON_MIN = 3;

export type InspectionErrors = Partial<Record<'acceptedQty' | 'rejectedQty' | 'quarantineQty' | 'reason', string>>;

/** Mirrors the shared inspection schema and the server's split rule so mistakes are caught before sending. */
export function validateInspection(draft: InspectionDraft, underInspection: string): InspectionErrors {
  const errors: InspectionErrors = {};
  const quantities = [
    ['acceptedQty', draft.acceptedQty],
    ['rejectedQty', draft.rejectedQty],
    ['quarantineQty', draft.quarantineQty],
  ] as const;
  const rejects =
    draft.outcome === 'FAIL' ||
    (draft.outcome === 'PARTIAL' && (Number(draft.rejectedQty || '0') > 0 || Number(draft.quarantineQty || '0') > 0));
  if (draft.outcome === 'PARTIAL') {
    for (const [field, value] of quantities) {
      if (!QTY.test(value)) errors[field] = '0 or more, up to 4 decimals';
    }
    if (quantities.every(([, value]) => QTY.test(value))) {
      const total = sumDecimal(quantities.map(([, value]) => value), 4);
      if (compareDecimal(total, underInspection) !== 0) {
        errors.acceptedQty = `Accepted, rejected and quarantine must add up to ${underInspection}`;
      }
    }
  }
  if (rejects && draft.reason.trim().length < REASON_MIN) {
    errors.reason = 'Say why goods are rejected or quarantined';
  }
  return errors;
}

/** Request body for an inspection; quantities are only sent for PARTIAL, as the API requires. */
export function buildInspectionBody(draft: InspectionDraft): InspectionInput {
  const optional = (value: string): string | undefined => (value.trim() ? value.trim() : undefined);
  return {
    outcome: draft.outcome,
    ...(draft.outcome === 'PARTIAL'
      ? { acceptedQty: draft.acceptedQty, rejectedQty: draft.rejectedQty, quarantineQty: draft.quarantineQty }
      : {}),
    ...(optional(draft.reason) ? { reason: draft.reason.trim() } : {}),
    ...(optional(draft.remarks) ? { remarks: draft.remarks.trim() } : {}),
    ...(optional(draft.testResult) ? { testResult: draft.testResult.trim() } : {}),
    ...(optional(draft.certificateNo) ? { certificateNo: draft.certificateNo.trim() } : {}),
  };
}

/** What the latest recorded inspection of a draft line says, for the summary shown before posting. */
export function latestInspection(line: GoodsReceiptLine): GoodsReceiptLine['inspections'][number] | undefined {
  return [...line.inspections].sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt))[0];
}

export type ReceiptLineDraft = {
  orderLineId: string;
  receivedQty: string;
  rejectedQty: string;
  rejectionReason: string;
  batchNo: string;
  expiryDate: string;
  serials: string;
};

export type ReceiptLineErrors = Partial<Record<'receivedQty' | 'rejectedQty' | 'batchNo' | 'expiryDate' | 'serials', string>>;

type LineRules = { trackBatch: boolean; trackExpiry: boolean; trackSerial: boolean };

export function splitSerials(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((serial) => serial.trim())
    .filter(Boolean);
}

/** Checks a receipt line the way the server will; untouched lines (nothing received) are skipped by the caller. */
export function validateReceiptLine(line: ReceiptLineDraft, rules: LineRules): ReceiptLineErrors {
  const errors: ReceiptLineErrors = {};
  if (!QTY.test(line.receivedQty) || Number(line.receivedQty) <= 0) {
    errors.receivedQty = 'Above 0, up to 4 decimals';
    return errors;
  }
  if (line.rejectedQty && (!QTY.test(line.rejectedQty) || compareDecimal(line.rejectedQty, line.receivedQty) > 0)) {
    errors.rejectedQty = 'Cannot exceed the quantity received';
  }
  if (rules.trackBatch && !line.batchNo.trim()) errors.batchNo = 'Batch number required';
  if (rules.trackExpiry && !line.expiryDate) errors.expiryDate = 'Expiry date required';
  if (rules.trackSerial) {
    const serials = splitSerials(line.serials);
    if (!isDecimal(line.receivedQty) || !Number.isInteger(Number(line.receivedQty))) {
      errors.receivedQty = 'Serialized items are received in whole units';
    } else if (serials.length !== Number(line.receivedQty)) {
      errors.serials = `Enter exactly ${line.receivedQty} serial number(s), one per unit`;
    } else if (new Set(serials).size !== serials.length) {
      errors.serials = 'Serial numbers must be unique';
    }
  }
  return errors;
}
