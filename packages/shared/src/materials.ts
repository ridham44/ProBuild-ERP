import { z } from 'zod';
import { dateSchema, idSchema, listQuerySchema, quantitySchema } from './common';

const optionalText = (max: number) => z.string().trim().max(max).nullish();
const unitSchema = z.string().trim().min(1).max(12);
const MAX_LINES = 200;

const noDuplicateKeys = <T>(rows: T[] | undefined, key: (row: T) => string): boolean => {
  if (!rows) return true;
  const seen = new Set<string>();
  for (const row of rows) {
    const k = key(row);
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
};

// ---- Material request ---------------------------------------------------------------------------

export const MR_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED'] as const;

export const materialRequestLineSchema = z.object({
  itemId: idSchema,
  qty: quantitySchema,
  unit: unitSchema.optional(),
  purpose: optionalText(300),
  wbsNodeId: idSchema.nullish(),
  costCodeId: idSchema.nullish(),
  boqItemId: idSchema.nullish(),
});
export type MaterialRequestLineInput = z.infer<typeof materialRequestLineSchema>;

const materialRequestFields = z.object({
  projectId: idSchema,
  warehouseId: idSchema,
  employeeId: idSchema.nullish(),
  /** Header defaults; a line's own WBS / cost code wins. */
  wbsNodeId: idSchema.nullish(),
  costCodeId: idSchema.nullish(),
  neededDate: dateSchema.nullish(),
  purpose: optionalText(300),
  remarks: optionalText(1000),
  lines: z.array(materialRequestLineSchema).min(1).max(MAX_LINES),
});
export const createMaterialRequestSchema = materialRequestFields;
export type CreateMaterialRequestInput = z.infer<typeof createMaterialRequestSchema>;
export const updateMaterialRequestSchema = materialRequestFields.omit({ projectId: true }).partial();
export type UpdateMaterialRequestInput = z.infer<typeof updateMaterialRequestSchema>;

/** The approver may lower (never raise) what each line is approved for; omitted lines keep their requested quantity. */
export const approveMaterialRequestSchema = z.object({
  comment: z.string().trim().max(500).optional(),
  lines: z
    .array(z.object({ lineId: idSchema, approvedQty: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Must be 0 or greater with at most 4 decimal places') }))
    .max(MAX_LINES)
    .optional(),
});
export type ApproveMaterialRequestInput = z.infer<typeof approveMaterialRequestSchema>;

export const MR_SORT_FIELDS = ['number', 'createdAt', 'neededDate', 'estimatedTotal'] as const;
export const materialRequestListQuerySchema = listQuerySchema.extend({
  status: z.enum(MR_STATUSES).optional(),
  projectId: idSchema.optional(),
  warehouseId: idSchema.optional(),
  requestedById: idSchema.optional(),
  /** Approved requests that still have quantity left to issue. */
  issuable: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});
export type MaterialRequestListQuery = z.infer<typeof materialRequestListQuerySchema>;

// ---- Material issue -----------------------------------------------------------------------------

export const MI_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'] as const;

export const materialIssueLineSchema = z.object({
  /** Issuing against a request: the request line. Direct issues give itemId plus the cost dimensions instead. */
  requestLineId: idSchema.optional(),
  itemId: idSchema.optional(),
  qty: quantitySchema,
  unit: unitSchema.optional(),
  /** Leave empty to let the system pick (FEFO for expiry-tracked items, oldest batch otherwise). */
  batchNo: z.string().trim().max(60).optional(),
  /** Serialized items: the serials to issue; one per unit. Leave empty to auto-pick in-stock serials. */
  serialNos: z.array(z.string().trim().min(1).max(80)).max(1000).optional(),
  locationId: idSchema.nullish(),
  wbsNodeId: idSchema.nullish(),
  costCodeId: idSchema.nullish(),
  boqItemId: idSchema.nullish(),
});
export type MaterialIssueLineInput = z.infer<typeof materialIssueLineSchema>;

const issueFields = z.object({
  issueDate: dateSchema.optional(),
  receivedBy: optionalText(120),
  vehicle: optionalText(60),
  deliveryRef: optionalText(80),
  remarks: optionalText(1000),
});

export const createMaterialIssueSchema = issueFields
  .extend({
    /** Issue from an approved request. Without it this is a direct issue and projectId + warehouseId are required. */
    requestId: idSchema.optional(),
    projectId: idSchema.optional(),
    warehouseId: idSchema.optional(),
    /** Omit when issuing from a request to issue every approved remaining quantity. */
    lines: z.array(materialIssueLineSchema).min(1).max(MAX_LINES).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.requestId) {
      if (v.projectId || v.warehouseId) ctx.addIssue({ code: 'custom', path: ['requestId'], message: 'projectId and warehouseId come from the request' });
      for (const [i, l] of (v.lines ?? []).entries()) {
        if (!l.requestLineId) ctx.addIssue({ code: 'custom', path: ['lines', i, 'requestLineId'], message: 'requestLineId is required when issuing from a request' });
      }
    } else {
      if (!v.projectId) ctx.addIssue({ code: 'custom', path: ['projectId'], message: 'projectId is required for a direct issue' });
      if (!v.warehouseId) ctx.addIssue({ code: 'custom', path: ['warehouseId'], message: 'warehouseId is required for a direct issue' });
      if (!v.lines) ctx.addIssue({ code: 'custom', path: ['lines'], message: 'lines are required for a direct issue' });
      if (!v.remarks || v.remarks.length < 3) ctx.addIssue({ code: 'custom', path: ['remarks'], message: 'A direct issue needs a reason in remarks' });
      for (const [i, l] of (v.lines ?? []).entries()) {
        if (!l.itemId) ctx.addIssue({ code: 'custom', path: ['lines', i, 'itemId'], message: 'itemId is required for a direct issue' });
      }
    }
    if (!noDuplicateKeys(v.lines, (l) => `${l.requestLineId ?? l.itemId ?? ''}|${l.batchNo ?? ''}|${(l.serialNos ?? []).join(',')}`)) {
      ctx.addIssue({ code: 'custom', path: ['lines'], message: 'Duplicate issue lines' });
    }
  });
export type CreateMaterialIssueInput = z.infer<typeof createMaterialIssueSchema>;

export const updateMaterialIssueSchema = issueFields.extend({ lines: z.array(materialIssueLineSchema).min(1).max(MAX_LINES).optional() });
export type UpdateMaterialIssueInput = z.infer<typeof updateMaterialIssueSchema>;

export const MI_SORT_FIELDS = ['number', 'issueDate', 'createdAt', 'postedAt', 'totalCost'] as const;
export const materialIssueListQuerySchema = listQuerySchema.extend({
  status: z.enum(MI_STATUSES).optional(),
  projectId: idSchema.optional(),
  warehouseId: idSchema.optional(),
  requestId: idSchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});
export type MaterialIssueListQuery = z.infer<typeof materialIssueListQuerySchema>;

// ---- Material return ----------------------------------------------------------------------------

export const RETURN_CONDITIONS = ['GOOD', 'DAMAGED', 'QUARANTINE'] as const;

export const materialReturnLineSchema = z.object({
  /** Every return points at the issue line it reverses; the original issue cost is credited back to the project. */
  issueLineId: idSchema,
  qty: quantitySchema,
  condition: z.enum(RETURN_CONDITIONS),
  serialNo: z.string().trim().min(1).max(80).nullish(),
});
export type MaterialReturnLineInput = z.infer<typeof materialReturnLineSchema>;

export const createMaterialReturnSchema = z.object({
  issueId: idSchema,
  returnDate: dateSchema.optional(),
  reason: z.string().trim().min(3).max(500),
  lines: z.array(materialReturnLineSchema).min(1).max(MAX_LINES),
});
export type CreateMaterialReturnInput = z.infer<typeof createMaterialReturnSchema>;

export const materialReturnListQuerySchema = listQuerySchema.extend({
  status: z.enum(['DRAFT', 'POSTED', 'CANCELLED']).optional(),
  projectId: idSchema.optional(),
  warehouseId: idSchema.optional(),
  issueId: idSchema.optional(),
});
export type MaterialReturnListQuery = z.infer<typeof materialReturnListQuerySchema>;

// ---- Project cost -------------------------------------------------------------------------------

export const budgetVsActualQuerySchema = z.object({ includeUnbudgeted: z.enum(['true', 'false']).transform((v) => v === 'true').default(true) });
export type BudgetVsActualQuery = z.infer<typeof budgetVsActualQuerySchema>;
