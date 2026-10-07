import { z } from 'zod';
import { decimalSchema, idSchema } from './common';

/** Document types that can run through the approval engine. */
export const APPROVAL_DOCUMENT_TYPES = [
  'PURCHASE_REQUISITION', 'PURCHASE_ORDER', 'SUPPLIER_QUOTATION', 'MATERIAL_ISSUE', 'MATERIAL_RETURN',
  'STOCK_ADJUSTMENT', 'WAREHOUSE_TRANSFER', 'PAYMENT', 'EXPENSE', 'TIMESHEET', 'OVERTIME',
  'SUBCONTRACTOR_BILLING', 'CLIENT_BILLING', 'CHANGE_ORDER', 'BUDGET_REVISION',
  'CONTRACT_VARIATION', 'PROJECT_CLOSURE', 'PAYROLL', 'STOCK_COUNT',
] as const;
export type ApprovalDocumentType = (typeof APPROVAL_DOCUMENT_TYPES)[number];

export const upsertWorkflowSchema = z.object({
  documentType: z.enum(APPROVAL_DOCUMENT_TYPES),
  name: z.string().trim().min(1).max(120),
  active: z.boolean().default(true),
  rules: z
    .array(
      z.object({
        minAmount: decimalSchema,
        maxAmount: decimalSchema.nullish(),
        steps: z.array(z.object({ roleName: z.string().min(1) })).min(1),
      }),
    )
    .min(1),
});
export type UpsertWorkflowInput = z.infer<typeof upsertWorkflowSchema>;

export const approvalDecisionSchema = z.object({
  comment: z.string().max(500).optional(),
  signature: z.string().max(200_000).optional(),
});
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;

export const approvalRequestFilterSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  mine: z.coerce.boolean().optional(),
  documentType: z.enum(APPROVAL_DOCUMENT_TYPES).optional(),
  projectId: idSchema.optional(),
});
