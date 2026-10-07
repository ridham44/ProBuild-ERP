import { z } from 'zod';
import {
  dateSchema,
  idSchema,
  listQuerySchema,
  moneySchema,
  percentSchema,
  quantitySchema,
  unitPriceSchema,
} from './common';

const codeSchema = z.string().trim().min(1).max(30);
const nameSchema = z.string().trim().min(1).max(160);
const optionalText = (max: number) => z.string().trim().max(max).nullish();

// ---- Projects -----------------------------------------------------------------------------------

export const PROJECT_TYPES = [
  'GENERAL_BUILDING', 'CIVIL', 'INFRASTRUCTURE', 'ROADS', 'BRIDGES', 'WATER', 'ELECTRICAL', 'MECHANICAL', 'HVAC',
  'PLUMBING', 'MEP', 'FIT_OUT', 'INTERIOR', 'RENOVATION', 'INDUSTRIAL', 'RESIDENTIAL', 'COMMERCIAL', 'SPECIALTY',
] as const;
export const PROJECT_STATUSES = ['PIPELINE', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CLOSED', 'CANCELLED'] as const;
export type ProjectStatusKey = (typeof PROJECT_STATUSES)[number];

/** Allowed project status moves. CLOSED and CANCELLED are terminal. */
export const PROJECT_TRANSITIONS: Record<ProjectStatusKey, readonly ProjectStatusKey[]> = {
  PIPELINE: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['CLOSED', 'ACTIVE'],
  CLOSED: [],
  CANCELLED: [],
};

const projectFields = z.object({
  code: codeSchema,
  name: nameSchema,
  customerId: idSchema,
  branchId: idSchema.nullish(),
  managerId: idSchema.nullish(),
  costCenterId: idSchema.nullish(),
  type: z.enum(PROJECT_TYPES).optional(),
  sector: z.enum(['PRIVATE', 'GOVERNMENT']).optional(),
  fundingSource: optionalText(120),
  location: optionalText(300),
  contractAmount: moneySchema.optional(),
  startDate: dateSchema.nullish(),
  originalEndDate: dateSchema.nullish(),
  retentionPct: percentSchema.optional(),
  advancePct: percentSchema.optional(),
  warrantyMonths: z.number().int().min(0).max(120).optional(),
  ldRatePct: percentSchema.optional(),
  paymentTerms: optionalText(300),
});

const datesInOrder = (v: { startDate?: Date | null; originalEndDate?: Date | null }) =>
  !v.startDate || !v.originalEndDate || v.originalEndDate >= v.startDate;
const DATE_ORDER_ISSUE = { message: 'originalEndDate must not precede startDate', path: ['originalEndDate'] };

export const createProjectSchema = projectFields.refine(datesInOrder, DATE_ORDER_ISSUE);
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export const updateProjectSchema = projectFields.partial().extend({ revisedEndDate: dateSchema.nullish() }).refine(datesInOrder, DATE_ORDER_ISSUE);
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const PROJECT_SORT_FIELDS = ['code', 'name', 'startDate', 'createdAt', 'contractAmount'] as const;
export const projectListQuerySchema = listQuerySchema.extend({
  status: z.enum(PROJECT_STATUSES).optional(),
  customerId: idSchema.optional(),
  branchId: idSchema.optional(),
  managerId: idSchema.optional(),
});
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;

export const projectStatusChangeSchema = z.object({
  status: z.enum(PROJECT_STATUSES),
  reason: z.string().trim().min(3).max(500).optional(),
});
export type ProjectStatusChangeInput = z.infer<typeof projectStatusChangeSchema>;

export const addProjectMemberSchema = z.object({
  userId: idSchema,
  role: z.string().trim().min(1).max(60),
});
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
export const updateProjectMemberSchema = z.object({ role: z.string().trim().min(1).max(60) });

// ---- Contract -----------------------------------------------------------------------------------

export const createContractSchema = z.object({
  title: nameSchema,
  contractType: z.enum(['LUMP_SUM', 'UNIT_PRICE', 'COST_PLUS', 'DESIGN_BUILD']).optional(),
  originalAmount: moneySchema,
  signedDate: dateSchema.nullish(),
  noticeToProceed: dateSchema.nullish(),
  clauses: optionalText(4000),
});
export type CreateContractInput = z.infer<typeof createContractSchema>;
export const updateContractSchema = createContractSchema.partial();
export type UpdateContractInput = z.infer<typeof updateContractSchema>;

// ---- WBS ----------------------------------------------------------------------------------------

export const createWbsNodeSchema = z.object({
  parentId: idSchema.nullish(),
  code: codeSchema,
  name: nameSchema,
  sortOrder: z.number().int().min(0).optional(),
  weightPct: percentSchema.optional(),
});
export type CreateWbsNodeInput = z.infer<typeof createWbsNodeSchema>;
export const updateWbsNodeSchema = z.object({
  code: codeSchema.optional(),
  name: nameSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
  weightPct: percentSchema.optional(),
});
export type UpdateWbsNodeInput = z.infer<typeof updateWbsNodeSchema>;
export const moveWbsNodeSchema = z.object({
  parentId: idSchema.nullable(),
  sortOrder: z.number().int().min(0).optional(),
});
export type MoveWbsNodeInput = z.infer<typeof moveWbsNodeSchema>;

// ---- Cost codes ---------------------------------------------------------------------------------

export const COST_CATEGORY_KEYS = ['MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACT', 'OTHER'] as const;
export const createCostCodeSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  category: z.enum(COST_CATEGORY_KEYS).optional(),
  parentId: idSchema.nullish(),
});
export type CreateCostCodeInput = z.infer<typeof createCostCodeSchema>;
export const updateCostCodeSchema = createCostCodeSchema.partial().extend({ active: z.boolean().optional() });
export type UpdateCostCodeInput = z.infer<typeof updateCostCodeSchema>;

export const COST_CODE_SORT_FIELDS = ['code', 'name', 'createdAt'] as const;
export const costCodeListQuerySchema = listQuerySchema.extend({
  category: z.enum(COST_CATEGORY_KEYS).optional(),
  parentId: idSchema.optional(),
  active: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});
export type CostCodeListQuery = z.infer<typeof costCodeListQuerySchema>;

// ---- Estimate / BOQ -----------------------------------------------------------------------------

export const ESTIMATE_TYPES = ['PRELIMINARY', 'TENDER', 'DETAILED', 'REVISED', 'APPROVED'] as const;
export const createEstimateSchema = z.object({
  name: optionalText(160),
  type: z.enum(ESTIMATE_TYPES).optional(),
  overheadPct: percentSchema.optional(),
  profitPct: percentSchema.optional(),
  taxPct: percentSchema.optional(),
});
export type CreateEstimateInput = z.infer<typeof createEstimateSchema>;
export const updateEstimateSchema = createEstimateSchema.partial();
export type UpdateEstimateInput = z.infer<typeof updateEstimateSchema>;

export const createBoqItemSchema = z.object({
  section: optionalText(120),
  itemNo: z.string().trim().min(1).max(30),
  description: z.string().trim().min(1).max(500),
  costCategory: z.enum(COST_CATEGORY_KEYS).optional(),
  unit: z.string().trim().min(1).max(12),
  quantity: quantitySchema,
  unitRate: unitPriceSchema,
  wbsNodeId: idSchema.nullish(),
  costCodeId: idSchema.nullish(),
});
export type CreateBoqItemInput = z.infer<typeof createBoqItemSchema>;
export const updateBoqItemSchema = createBoqItemSchema.partial();
export type UpdateBoqItemInput = z.infer<typeof updateBoqItemSchema>;

export const boqListQuerySchema = listQuerySchema.extend({
  estimateId: idSchema.optional(),
  wbsNodeId: idSchema.optional(),
  costCodeId: idSchema.optional(),
});
export type BoqListQuery = z.infer<typeof boqListQuerySchema>;
