import { z } from 'zod';
import {
  dateSchema,
  idSchema,
  listQuerySchema,
  moneySchema,
  percentSchema,
  prioritySchema,
  quantitySchema,
  unitPriceSchema,
} from './common';

const optionalText = (max: number) => z.string().trim().max(max).nullish();
const unitSchema = z.string().trim().min(1).max(12);
const MAX_LINES = 200;

const noDuplicates = <T>(rows: T[], key: (row: T) => string | null | undefined): boolean => {
  const seen = new Set<string>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
};

// ---- Purchase requisition ------------------------------------------------------------------------

export const PR_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PARTIALLY_ORDERED', 'ORDERED', 'CANCELLED', 'CLOSED'] as const;

export const requisitionLineSchema = z.object({
  itemId: idSchema,
  description: optionalText(300),
  qty: quantitySchema,
  unit: unitSchema.optional(),
  requiredDate: dateSchema.nullish(),
  warehouseId: idSchema.nullish(),
  wbsNodeId: idSchema.nullish(),
  costCodeId: idSchema.nullish(),
  boqItemId: idSchema.nullish(),
  justification: optionalText(500),
  /** Optional override; the server defaults to the item's last purchase cost, then its standard cost. */
  estimatedUnitCost: unitPriceSchema.optional(),
});
export type RequisitionLineInput = z.infer<typeof requisitionLineSchema>;

const requisitionFields = z.object({
  projectId: idSchema,
  warehouseId: idSchema.nullish(),
  priority: prioritySchema.optional(),
  requiredDate: dateSchema.nullish(),
  purpose: optionalText(300),
  remarks: optionalText(1000),
  lines: z.array(requisitionLineSchema).min(1).max(MAX_LINES),
});

export const createRequisitionSchema = requisitionFields;
export type CreateRequisitionInput = z.infer<typeof createRequisitionSchema>;
/** Updating a draft replaces the line set when `lines` is sent; projectId cannot change. */
export const updateRequisitionSchema = requisitionFields.omit({ projectId: true }).partial();
export type UpdateRequisitionInput = z.infer<typeof updateRequisitionSchema>;

export const REQUISITION_SORT_FIELDS = ['number', 'createdAt', 'requiredDate', 'estimatedTotal'] as const;
export const requisitionListQuerySchema = listQuerySchema.extend({
  status: z.enum(PR_STATUSES).optional(),
  projectId: idSchema.optional(),
  requesterId: idSchema.optional(),
  priority: prioritySchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});
export type RequisitionListQuery = z.infer<typeof requisitionListQuerySchema>;

/** Decision payload for the document-level approve/reject endpoints. */
export const documentDecisionSchema = z.object({ comment: z.string().trim().max(500).optional() });
export const documentRejectionSchema = z.object({ comment: z.string().trim().min(3).max(500) });
export type DocumentDecisionInput = z.infer<typeof documentDecisionSchema>;

// ---- RFQ -----------------------------------------------------------------------------------------

export const RFQ_STATUSES = ['DRAFT', 'SENT', 'QUOTED', 'AWARDED', 'CLOSED', 'CANCELLED'] as const;

export const rfqLineSchema = z.object({
  requisitionLineId: idSchema,
  /** Defaults to the requisition line's remaining (un-ordered) quantity. */
  qty: quantitySchema.optional(),
});

const rfqFields = z.object({
  requisitionId: idSchema,
  supplierIds: z.array(idSchema).min(1).max(30),
  lines: z.array(rfqLineSchema).min(1).max(MAX_LINES),
  dueDate: dateSchema,
  requiredDate: dateSchema.nullish(),
  deliveryRequirements: optionalText(1000),
  deliveryLocation: optionalText(300),
  remarks: optionalText(1000),
});
const rfqRules = [
  { check: (v: { supplierIds?: string[] }) => !v.supplierIds || new Set(v.supplierIds).size === v.supplierIds.length, message: 'Suppliers must be unique', path: 'supplierIds' },
  { check: (v: { lines?: Array<{ requisitionLineId: string }> }) => !v.lines || noDuplicates(v.lines, (l) => l.requisitionLineId), message: 'A requisition line can appear only once', path: 'lines' },
] as const;

export const createRfqSchema = rfqFields.superRefine((v, ctx) => {
  for (const r of rfqRules) if (!r.check(v)) ctx.addIssue({ code: 'custom', path: [r.path], message: r.message });
});
export type CreateRfqInput = z.infer<typeof createRfqSchema>;
export const updateRfqSchema = rfqFields.omit({ requisitionId: true }).partial().superRefine((v, ctx) => {
  for (const r of rfqRules) if (!r.check(v)) ctx.addIssue({ code: 'custom', path: [r.path], message: r.message });
});
export type UpdateRfqInput = z.infer<typeof updateRfqSchema>;

export const RFQ_SORT_FIELDS = ['number', 'createdAt', 'dueDate'] as const;
export const rfqListQuerySchema = listQuerySchema.extend({
  status: z.enum(RFQ_STATUSES).optional(),
  projectId: idSchema.optional(),
  requisitionId: idSchema.optional(),
  supplierId: idSchema.optional(),
});
export type RfqListQuery = z.infer<typeof rfqListQuerySchema>;

export const awardRfqSchema = z.object({
  quotationId: idSchema,
  reason: z.string().trim().max(500).optional(),
});
export type AwardRfqInput = z.infer<typeof awardRfqSchema>;

// ---- Supplier quotation --------------------------------------------------------------------------

export const quotationLineSchema = z.object({
  rfqLineId: idSchema,
  /** Defaults to the RFQ line quantity; a supplier may quote a partial quantity but never more. */
  qty: quantitySchema.optional(),
  unitPrice: unitPriceSchema,
  discountPct: percentSchema.optional(),
  taxPct: percentSchema.optional(),
  deliveryDate: dateSchema.nullish(),
  brand: optionalText(80),
  specification: optionalText(500),
  remarks: optionalText(300),
});
export type QuotationLineInput = z.infer<typeof quotationLineSchema>;

const quotationFields = z.object({
  supplierId: idSchema,
  quoteNo: optionalText(40),
  quoteDate: dateSchema,
  validUntil: dateSchema.nullish(),
  deliveryDays: z.number().int().min(0).max(1000).nullish(),
  paymentTerms: optionalText(200),
  warranty: optionalText(200),
  currency: z.string().length(3).optional(),
  freight: moneySchema.optional(),
  lines: z.array(quotationLineSchema).min(1).max(MAX_LINES),
});
const quotationRules = (v: { lines?: Array<{ rfqLineId: string }>; quoteDate?: Date; validUntil?: Date | null }) =>
  (!v.lines || noDuplicates(v.lines, (l) => l.rfqLineId)) && (!v.validUntil || !v.quoteDate || v.validUntil >= v.quoteDate);

export const createQuotationSchema = quotationFields.refine(quotationRules, {
  message: 'Lines must be unique per RFQ line and validUntil must not precede quoteDate',
  path: ['lines'],
});
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
/** Revising a quotation replaces its lines; the supplier cannot change. */
export const updateQuotationSchema = quotationFields.omit({ supplierId: true }).refine(quotationRules, {
  message: 'Lines must be unique per RFQ line and validUntil must not precede quoteDate',
  path: ['lines'],
});
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>;

export const quotationListQuerySchema = listQuerySchema.extend({
  rfqId: idSchema.optional(),
  supplierId: idSchema.optional(),
  status: z.enum(['SUBMITTED', 'AWARDED', 'NOT_AWARDED']).optional(),
});
export type QuotationListQuery = z.infer<typeof quotationListQuerySchema>;

// ---- Purchase order ------------------------------------------------------------------------------

export const PO_STATUSES = [
  'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED',
] as const;

const poHeaderFields = {
  warehouseId: idSchema.optional(),
  orderDate: dateSchema.optional(),
  expectedDate: dateSchema.nullish(),
  deliveryLocation: optionalText(300),
  paymentTerms: optionalText(200),
  terms: optionalText(2000),
  freight: moneySchema.optional(),
};

export const poRequisitionLineSchema = z.object({
  requisitionLineId: idSchema,
  qty: quantitySchema,
  unitPrice: unitPriceSchema,
  discountPct: percentSchema.optional(),
  taxPct: percentSchema.optional(),
  deliveryDate: dateSchema.nullish(),
  description: optionalText(300),
});

/**
 * A PO is raised from an awarded quotation (source=QUOTATION, only quotationId + header fields) or directly
 * from approved requisition lines (source=REQUISITION with requisitionId, supplierId and priced lines).
 */
export const createPurchaseOrderSchema = z
  .object({
    source: z.enum(['QUOTATION', 'REQUISITION']),
    quotationId: idSchema.optional(),
    requisitionId: idSchema.optional(),
    supplierId: idSchema.optional(),
    lines: z.array(poRequisitionLineSchema).min(1).max(MAX_LINES).optional(),
    ...poHeaderFields,
  })
  .superRefine((v, ctx) => {
    const need = (ok: boolean, path: string, message: string) => {
      if (!ok) ctx.addIssue({ code: 'custom', path: [path], message });
    };
    if (v.source === 'QUOTATION') {
      need(Boolean(v.quotationId), 'quotationId', 'quotationId is required when source is QUOTATION');
      need(!v.lines && !v.requisitionId && !v.supplierId, 'lines', 'lines, requisitionId and supplierId are taken from the quotation');
    } else {
      need(Boolean(v.requisitionId), 'requisitionId', 'requisitionId is required when source is REQUISITION');
      need(Boolean(v.supplierId), 'supplierId', 'supplierId is required when source is REQUISITION');
      need(Boolean(v.lines), 'lines', 'lines are required when source is REQUISITION');
      need(!v.quotationId, 'quotationId', 'quotationId is only valid when source is QUOTATION');
      if (v.lines && !noDuplicates(v.lines, (l) => l.requisitionLineId)) {
        ctx.addIssue({ code: 'custom', path: ['lines'], message: 'A requisition line can appear only once' });
      }
    }
  });
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

export const updatePoLineSchema = z.object({
  id: idSchema,
  qty: quantitySchema.optional(),
  unitPrice: unitPriceSchema.optional(),
  discountPct: percentSchema.optional(),
  taxPct: percentSchema.optional(),
  deliveryDate: dateSchema.nullish(),
  description: optionalText(300),
});
/** Draft edit. When `lines` is sent, lines that are not listed are removed (releasing requisition quantity). */
export const updatePurchaseOrderSchema = z
  .object({
    ...poHeaderFields,
    lines: z.array(updatePoLineSchema).min(1).max(MAX_LINES).optional(),
  })
  .refine((v) => !v.lines || noDuplicates(v.lines, (l) => l.id), { message: 'A line can appear only once', path: ['lines'] });
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;

export const PO_SORT_FIELDS = ['number', 'orderDate', 'createdAt', 'totalAmount', 'expectedDate'] as const;
export const purchaseOrderListQuerySchema = listQuerySchema.extend({
  status: z.enum(PO_STATUSES).optional(),
  supplierId: idSchema.optional(),
  projectId: idSchema.optional(),
  warehouseId: idSchema.optional(),
  requisitionId: idSchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});
export type PurchaseOrderListQuery = z.infer<typeof purchaseOrderListQuerySchema>;

