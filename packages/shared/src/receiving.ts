import { z } from 'zod';
import { dateSchema, decimalSchema, idSchema, listQuerySchema, quantitySchema } from './common';

const optionalText = (max: number) => z.string().trim().max(max).nullish();
const MAX_LINES = 200;

/** Zero is allowed (e.g. nothing rejected); at most 4 decimal places like every quantity column. */
export const zeroOrMoreQtySchema = decimalSchema.refine((v) => /^\d+(\.\d{1,4})?$/.test(v), 'Must be 0 or greater with at most 4 decimal places');

export const GRN_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'] as const;
export const QC_OUTCOMES = ['PASS', 'FAIL', 'PARTIAL'] as const;
export const qcOutcomeSchema = z.enum(QC_OUTCOMES);

// ---- QC inspection ------------------------------------------------------------------------------

export const qcAttachmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  /** Reference to an uploaded document (document id or storage URL); the file itself lives in the document store. */
  ref: z.string().trim().min(1).max(500),
});

export const qcChecklistItemSchema = z.object({
  item: z.string().trim().min(1).max(200),
  passed: z.boolean(),
  note: z.string().trim().max(300).optional(),
});

/**
 * PASS accepts everything that was not already rejected at the dock, FAIL rejects everything. PARTIAL states the split;
 * the accepted + rejected + quarantine quantities must add up to the quantity under inspection (checked server-side).
 */
export const inspectionSchema = z
  .object({
    outcome: qcOutcomeSchema,
    acceptedQty: zeroOrMoreQtySchema.optional(),
    rejectedQty: zeroOrMoreQtySchema.optional(),
    quarantineQty: zeroOrMoreQtySchema.optional(),
    reason: optionalText(500),
    remarks: optionalText(1000),
    testResult: optionalText(500),
    certificateNo: optionalText(80),
    checklist: z.array(qcChecklistItemSchema).max(50).optional(),
    attachments: z.array(qcAttachmentSchema).max(20).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.outcome === 'PARTIAL' && (v.acceptedQty === undefined || v.rejectedQty === undefined || v.quarantineQty === undefined)) {
      ctx.addIssue({ code: 'custom', path: ['outcome'], message: 'A PARTIAL inspection must state acceptedQty, rejectedQty and quarantineQty' });
    }
    if (v.outcome !== 'PARTIAL' && (v.acceptedQty !== undefined || v.rejectedQty !== undefined || v.quarantineQty !== undefined)) {
      ctx.addIssue({ code: 'custom', path: ['outcome'], message: 'Quantities may only be given for a PARTIAL inspection' });
    }
    const rejects = v.outcome === 'FAIL' || (v.outcome === 'PARTIAL' && (Number(v.rejectedQty ?? 0) > 0 || Number(v.quarantineQty ?? 0) > 0));
    if (rejects && !v.reason) ctx.addIssue({ code: 'custom', path: ['reason'], message: 'A reason is required when goods are rejected or quarantined' });
  });
export type InspectionInput = z.infer<typeof inspectionSchema>;

// ---- Goods receipt ------------------------------------------------------------------------------

export const goodsReceiptLineSchema = z.object({
  orderLineId: idSchema,
  /** Physical quantity delivered, in the PO line's unit. */
  receivedQty: quantitySchema,
  /** Quantity found unacceptable at the dock; QC can still refine it. */
  rejectedQty: zeroOrMoreQtySchema.optional(),
  rejectionReason: optionalText(300),
  locationId: idSchema.nullish(),
  batchNo: z.string().trim().max(60).optional(),
  expiryDate: dateSchema.nullish(),
  /** One serial per unit received, accepted units first, then quarantined, then rejected. */
  serialNos: z.array(z.string().trim().min(1).max(80)).max(1000).optional(),
});
export type GoodsReceiptLineInput = z.infer<typeof goodsReceiptLineSchema>;

const receiptHeader = z.object({
  receiptDate: dateSchema.optional(),
  supplierDrNo: optionalText(60),
  vehicle: optionalText(60),
  driver: optionalText(100),
  remarks: optionalText(1000),
});

const uniqueOrderLines = (lines?: Array<{ orderLineId: string; batchNo?: string }>) => {
  if (!lines) return true;
  const seen = new Set<string>();
  for (const l of lines) {
    const key = `${l.orderLineId}|${l.batchNo ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
};

export const createGoodsReceiptSchema = receiptHeader
  .extend({
    orderId: idSchema,
    lines: z.array(goodsReceiptLineSchema).min(1).max(MAX_LINES),
  })
  .refine((v) => uniqueOrderLines(v.lines), { path: ['lines'], message: 'A PO line can appear once per batch' });
export type CreateGoodsReceiptInput = z.infer<typeof createGoodsReceiptSchema>;

/** Editing a draft replaces its lines when `lines` is sent; the purchase order cannot change. */
export const updateGoodsReceiptSchema = receiptHeader
  .extend({ lines: z.array(goodsReceiptLineSchema).min(1).max(MAX_LINES).optional() })
  .refine((v) => uniqueOrderLines(v.lines), { path: ['lines'], message: 'A PO line can appear once per batch' });
export type UpdateGoodsReceiptInput = z.infer<typeof updateGoodsReceiptSchema>;

/** Over-receipt is only possible with the OVERRIDE permission, a reason, and within the company tolerance. */
export const postGoodsReceiptSchema = z.object({
  overReceipt: z.object({ reason: z.string().trim().min(5).max(500) }).optional(),
});
export type PostGoodsReceiptInput = z.infer<typeof postGoodsReceiptSchema>;

export const GRN_SORT_FIELDS = ['number', 'receiptDate', 'createdAt', 'postedAt'] as const;
export const goodsReceiptListQuerySchema = listQuerySchema.extend({
  status: z.enum(GRN_STATUSES).optional(),
  orderId: idSchema.optional(),
  supplierId: idSchema.optional(),
  warehouseId: idSchema.optional(),
  projectId: idSchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});
export type GoodsReceiptListQuery = z.infer<typeof goodsReceiptListQuerySchema>;
