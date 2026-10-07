import { z } from 'zod';
import { decimalSchema, idSchema } from './common';

const codeSchema = z.string().trim().min(1).max(30);
const nameSchema = z.string().trim().min(1).max(160);

export const WAREHOUSE_TYPES = [
  'CENTRAL', 'REGIONAL', 'PROJECT', 'SITE', 'TEMPORARY', 'CONTAINER',
  'YARD', 'TOOL_ROOM', 'EQUIPMENT_YARD', 'QUARANTINE', 'DAMAGED',
] as const;

export const updateCompanySchema = z.object({
  legalName: nameSchema,
  tradeName: z.string().max(160).nullish(),
  tin: z.string().max(30).nullish(),
  secNo: z.string().max(40).nullish(),
  dtiNo: z.string().max(40).nullish(),
  philgepsNo: z.string().max(40).nullish(),
  doleRegistrationNo: z.string().max(40).nullish(),
  businessPermitNo: z.string().max(40).nullish(),
  address: z.string().max(300).nullish(),
  email: z.string().email().nullish(),
  phone: z.string().max(40).nullish(),
  vatStatus: z.enum(['VAT', 'NON_VAT', 'EXEMPT']),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
}).partial();
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export const createBranchSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  address: z.string().max(300).nullish(),
});
export const updateBranchSchema = createBranchSchema.partial().extend({ active: z.boolean().optional() });

export const createDepartmentSchema = z.object({ code: codeSchema, name: nameSchema });
export const updateDepartmentSchema = createDepartmentSchema.partial().extend({ active: z.boolean().optional() });

export const createCostCenterSchema = z.object({ code: codeSchema, name: nameSchema });
export const updateCostCenterSchema = createCostCenterSchema.partial().extend({ active: z.boolean().optional() });

export const createWarehouseSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  type: z.enum(WAREHOUSE_TYPES).optional(),
  branchId: idSchema.nullish(),
  projectId: idSchema.nullish(),
  parentWarehouseId: idSchema.nullish(),
  address: z.string().max(300).nullish(),
});
export const updateWarehouseSchema = createWarehouseSchema.partial().extend({ active: z.boolean().optional() });

export const createLocationSchema = z.object({
  warehouseId: idSchema,
  parentId: idSchema.nullish(),
  level: z.enum(['ZONE', 'RACK', 'SHELF', 'BIN']),
  code: codeSchema,
});

export const createBankAccountSchema = z.object({
  bankName: nameSchema,
  branchName: z.string().max(120).nullish(),
  accountName: nameSchema,
  accountNo: z.string().trim().min(1).max(40),
  currency: z.string().length(3).optional(),
  glAccountId: idSchema.nullish(),
  openingBalance: decimalSchema.optional(),
});
export const updateBankAccountSchema = createBankAccountSchema.partial().extend({ active: z.boolean().optional() });
